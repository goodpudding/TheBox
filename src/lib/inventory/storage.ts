/**
 * Photo storage behind putPhoto / getPhoto / deletePhoto so Drive can move
 * to S3/R2 later without touching feature code.
 *
 * Dev default: local `.data/inventory-photos`.
 * When Google is configured: Drive folder `Inventory Photos / {folder}/`.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getGoogleCmsConfig } from "@/lib/google/config";
import {
  DriveClient,
  MIME,
  type DriveFile,
} from "@/lib/google/drive";
import { ServiceAccountTokenSource } from "@/lib/google/auth";

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
  <text x="400" y="350" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="#645e5e">The Box inventory</text>
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
    if (storageKey.startsWith(FIXTURE_PREFIX)) {
      return {
        storageKey,
        mimeType: "image/svg+xml",
        bytes: fixtureSvg(storageKey),
      };
    }
    if (!storageKey.startsWith("local:")) return null;
    const rel = storageKey.slice("local:".length);
    const filePath = path.join(LOCAL_DIR, rel);
    try {
      const bytes = await readFile(filePath);
      const ext = path.extname(rel).toLowerCase();
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
    const filePath = path.join(LOCAL_DIR, storageKey.slice("local:".length));
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
    if (storageKey.startsWith(FIXTURE_PREFIX)) {
      return {
        storageKey,
        mimeType: "image/svg+xml",
        bytes: fixtureSvg(storageKey),
      };
    }
    if (!storageKey.startsWith("drive:")) {
      return localFallback().getPhoto(storageKey);
    }
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
    if (!storageKey.startsWith("drive:")) {
      await localFallback().deletePhoto(storageKey);
      return;
    }
    await this.client.trashFile(storageKey.slice("drive:".length)).catch(() => undefined);
  }
}

let cached: PhotoStorage | null = null;

function localFallback(): LocalPhotoStorage {
  return new LocalPhotoStorage();
}

export function getPhotoStorage(): PhotoStorage {
  if (cached) return cached;
  const google = getGoogleCmsConfig();
  if (google) {
    const tokens = new ServiceAccountTokenSource(google.serviceAccount, [
      DRIVE_SCOPE,
    ]);
    cached = new DrivePhotoStorage(
      new DriveClient(tokens),
      google.folderId,
    );
    return cached;
  }
  cached = new LocalPhotoStorage();
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
