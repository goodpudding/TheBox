/**
 * Photo storage behind putPhoto / getPhoto / deletePhoto, so where the bytes
 * live can change (R2, say) without touching feature code.
 *
 * Where a new photo goes:
 * - The live site, and anything else running on the database: the
 *   `StoredFile` table. A Worker has no disk, so this is the only place that
 *   needs no setup.
 * - Fixture mode (`next dev`): local `.data/inventory-photos`.
 * - Drive folder `Inventory Photos / {folder}/`, only when
 *   INVENTORY_PHOTO_STORAGE=drive and Google is configured. It is not picked
 *   just because Google is configured for other syncs: a service account can
 *   only keep files in a shared drive, so an upload to an ordinary folder
 *   fails.
 *
 * A stored photo is read back from wherever its key says it is (`db:`,
 * `drive:`, `local:`), whatever new uploads use.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataProviderMode } from "@/lib/data/factory";
import { prisma } from "@/lib/db";
import { getGoogleCmsConfig } from "@/lib/google/config";
import {
  DriveClient,
  MIME,
  type DriveFile,
} from "@/lib/google/drive";
import { ServiceAccountTokenSource } from "@/lib/google/auth";
import {
  MAX_STORED_PHOTO_BYTES,
  PhotoRejectedError,
  databasePhotoId,
} from "./upload-policy";

const LOCAL_DIR = path.join(process.cwd(), ".data", "inventory-photos");

export interface PutPhotoInput {
  bytes: Buffer;
  mimeType: string;
  filename?: string;
  /** Drive / local subfolder: "temp" or an asset tag like BX-00042. */
  folder?: string;
}

export interface StoredPhoto {
  storageKey: string;
  mimeType: string;
  bytes: Buffer;
}

export interface PhotoStorage {
  putPhoto(input: PutPhotoInput): Promise<{ storageKey: string }>;
  getPhoto(storageKey: string): Promise<StoredPhoto | null>;
  deletePhoto(storageKey: string): Promise<void>;
}

const FIXTURE_PREFIX = "fixture:";

function fixtureSvg(key: string): Buffer {
  const label = key.slice(FIXTURE_PREFIX.length).replace(/-/g, " ");
  const hue =
    [...key].reduce((h, c) => (h + c.charCodeAt(0) * 17) % 360, 40) || 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect fill="hsl(${hue} 42% 78%)" width="800" height="600"/>
  <rect fill="hsl(${hue} 38% 32%)" x="40" y="40" width="720" height="520" rx="24" opacity="0.18"/>
  <text x="400" y="300" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" fill="#3a2408">${escapeXml(label)}</text>
  <text x="400" y="350" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="#645e5e">Makerspace inventory</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}

/** Absolute path for a `local:` key, or null when it leaves the photo dir. */
function localPath(storageKey: string): string | null {
  const root = path.resolve(LOCAL_DIR);
  const filePath = path.resolve(root, storageKey.slice("local:".length));
  if (!filePath.startsWith(root + path.sep)) return null;
  return filePath;
}

class LocalPhotoStorage implements PhotoStorage {
  async putPhoto(input: PutPhotoInput): Promise<{ storageKey: string }> {
    await mkdir(LOCAL_DIR, { recursive: true });
    const id = randomUUID();
    const ext = extFor(input.mimeType);
    const folder = (input.folder ?? "temp").replace(/[^A-Za-z0-9._-]/g, "_");
    const storageKey = `local:${folder}/${id}.${ext}`;
    const filePath = path.join(LOCAL_DIR, storageKey.replace(/^local:/, ""));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.bytes);
    return { storageKey };
  }

  async getPhoto(storageKey: string): Promise<StoredPhoto | null> {
    if (!storageKey.startsWith("local:")) return null;
    const filePath = localPath(storageKey);
    if (!filePath) return null;
    try {
      const bytes = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".svg"
            ? "image/svg+xml"
            : ext === ".webp"
              ? "image/webp"
              : "image/jpeg";
      return { storageKey, mimeType, bytes };
    } catch {
      return null;
    }
  }

  async deletePhoto(storageKey: string): Promise<void> {
    if (!storageKey.startsWith("local:")) return;
    const filePath = localPath(storageKey);
    if (!filePath) return;
    await unlink(filePath).catch(() => undefined);
  }
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

class DrivePhotoStorage implements PhotoStorage {
  constructor(
    private readonly client: DriveClient,
    private readonly rootFolderId: string,
  ) {}

  private async ensureFolder(parentId: string, name: string): Promise<string> {
    const existing = await this.client.findChildFolder(parentId, name);
    if (existing) return existing.id;
    return this.client.createFolder(parentId, name);
  }

  private async inventoryRoot(): Promise<string> {
    return this.ensureFolder(this.rootFolderId, "Inventory Photos");
  }

  async putPhoto(input: PutPhotoInput): Promise<{ storageKey: string }> {
    const root = await this.inventoryRoot();
    const folderName = input.folder ?? "temp";
    const folderId = await this.ensureFolder(root, folderName);
    const safe = (input.filename ?? "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
    const hash = createHash("sha1").update(input.bytes).digest("hex").slice(0, 8);
    const name = `${Date.now()}-${hash}-${safe}`;
    const file = await this.client.uploadFile({
      parentId: folderId,
      name,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });
    return { storageKey: `drive:${file.id}` };
  }

  async getPhoto(storageKey: string): Promise<StoredPhoto | null> {
    if (!storageKey.startsWith("drive:")) return null;
    const fileId = storageKey.slice("drive:".length);
    try {
      const [meta, bytes] = await Promise.all([
        this.client.getFile(fileId),
        this.client.downloadFile(fileId),
      ]);
      return {
        storageKey,
        mimeType: meta.mimeType || "image/jpeg",
        bytes,
      };
    } catch {
      return null;
    }
  }

  async deletePhoto(storageKey: string): Promise<void> {
    if (!storageKey.startsWith("drive:")) return;
    await this.client.trashFile(storageKey.slice("drive:".length)).catch(() => undefined);
  }
}

class DatabasePhotoStorage implements PhotoStorage {
  async putPhoto(input: PutPhotoInput): Promise<{ storageKey: string }> {
    if (input.bytes.length > MAX_STORED_PHOTO_BYTES) {
      throw new PhotoRejectedError(
        "That photo is too large to save. Try a smaller picture.",
        413,
      );
    }
    const id = randomUUID();
    await prisma.storedFile.create({
      data: {
        id,
        mimeType: input.mimeType,
        // A copy on its own ArrayBuffer, which is the type Prisma takes.
        bytes: new Uint8Array(input.bytes),
        folder: (input.folder ?? "temp").slice(0, 64),
      },
    });
    return { storageKey: `db:${id}` };
  }

  async getPhoto(storageKey: string): Promise<StoredPhoto | null> {
    const id = databasePhotoId(storageKey);
    if (!id) return null;
    const row = await prisma.storedFile.findUnique({ where: { id } });
    if (!row) return null;
    return { storageKey, mimeType: row.mimeType, bytes: Buffer.from(row.bytes) };
  }

  async deletePhoto(storageKey: string): Promise<void> {
    const id = databasePhotoId(storageKey);
    if (!id) return;
    await prisma.storedFile.deleteMany({ where: { id } });
  }
}

/** Sends a new photo to the configured place and finds a stored one by its key. */
class RoutedPhotoStorage implements PhotoStorage {
  private readonly database = new DatabasePhotoStorage();
  private readonly local = new LocalPhotoStorage();
  private driveStorage: DrivePhotoStorage | null | undefined;

  private drive(): DrivePhotoStorage | null {
    if (this.driveStorage !== undefined) return this.driveStorage;
    const google = getGoogleCmsConfig();
    this.driveStorage = google
      ? new DrivePhotoStorage(
          new DriveClient(
            new ServiceAccountTokenSource(google.serviceAccount, [DRIVE_SCOPE]),
          ),
          google.folderId,
        )
      : null;
    return this.driveStorage;
  }

  private forNewPhotos(): PhotoStorage {
    if ((process.env.INVENTORY_PHOTO_STORAGE ?? "").toLowerCase() === "drive") {
      const drive = this.drive();
      if (drive) return drive;
    }
    return getDataProviderMode() === "prisma" ? this.database : this.local;
  }

  private forKey(storageKey: string): PhotoStorage | null {
    if (storageKey.startsWith("db:")) return this.database;
    if (storageKey.startsWith("drive:")) return this.drive();
    if (storageKey.startsWith("local:")) return this.local;
    return null;
  }

  putPhoto(input: PutPhotoInput): Promise<{ storageKey: string }> {
    return this.forNewPhotos().putPhoto(input);
  }

  async getPhoto(storageKey: string): Promise<StoredPhoto | null> {
    if (storageKey.startsWith(FIXTURE_PREFIX)) {
      return {
        storageKey,
        mimeType: "image/svg+xml",
        bytes: fixtureSvg(storageKey),
      };
    }
    return (await this.forKey(storageKey)?.getPhoto(storageKey)) ?? null;
  }

  async deletePhoto(storageKey: string): Promise<void> {
    await this.forKey(storageKey)?.deletePhoto(storageKey);
  }
}

let cached: PhotoStorage | null = null;

export function getPhotoStorage(): PhotoStorage {
  cached ??= new RoutedPhotoStorage();
  return cached;
}

export async function putPhoto(
  input: PutPhotoInput,
): Promise<{ storageKey: string }> {
  return getPhotoStorage().putPhoto(input);
}

export async function getPhoto(
  storageKey: string,
): Promise<StoredPhoto | null> {
  return getPhotoStorage().getPhoto(storageKey);
}

export async function deletePhoto(storageKey: string): Promise<void> {
  return getPhotoStorage().deletePhoto(storageKey);
}

export { type DriveFile, MIME };
