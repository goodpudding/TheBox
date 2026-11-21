/**
 * Where the lobby display's pictures are kept: uploaded photos and promo
 * images. The row that describes a photo (caption, order, shown or hidden)
 * travels with the rest of the site's data; the bytes live here so that
 * loading the site's data never loads the pictures.
 *
 * Live site: one row per picture in DisplayPhotoBlob, as base64 text. The
 * Worker has no disk and no object storage, and D1 holds one value of up to
 * 2,000,000 bytes, which is why uploads stop at MAX_DISPLAY_PHOTO_BYTES.
 * Dev: files under `.data/display-photos`.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataProviderMode } from "@/lib/data/factory";
import { prisma } from "@/lib/db";
import { sniffImageType, type PhotoMimeType } from "@/lib/inventory/upload-policy";

export { MAX_DISPLAY_PHOTO_BYTES } from "./limits";

const LOCAL_DIR = path.join(process.cwd(), ".data", "display-photos");

const PHOTO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for an id this store issued. Anything else is never looked up. */
export function isDisplayPhotoId(value: unknown): value is string {
  return typeof value === "string" && PHOTO_ID.test(value);
}

function inDatabase(): boolean {
  return getDataProviderMode() === "prisma";
}

export async function putDisplayPhotoBytes(
  bytes: Uint8Array,
): Promise<{ id: string }> {
  const id = randomUUID();
  if (inDatabase()) {
    await prisma.displayPhotoBlob.create({
      data: { id, dataBase64: Buffer.from(bytes).toString("base64") },
    });
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, id), bytes);
  }
  return { id };
}

/**
 * The stored picture, or null when there is none. The type comes from the
 * bytes themselves, so something that is not a raster image is never served.
 */
export async function getDisplayPhotoBytes(
  id: string,
): Promise<{ bytes: Uint8Array; mimeType: PhotoMimeType } | null> {
  if (!isDisplayPhotoId(id)) return null;
  let bytes: Uint8Array;
  if (inDatabase()) {
    const row = await prisma.displayPhotoBlob.findUnique({ where: { id } });
    if (!row) return null;
    bytes = new Uint8Array(Buffer.from(row.dataBase64, "base64"));
  } else {
    try {
      bytes = new Uint8Array(await readFile(path.join(LOCAL_DIR, id)));
    } catch {
      return null;
    }
  }
  const mimeType = sniffImageType(bytes);
  return mimeType ? { bytes, mimeType } : null;
}

export async function deleteDisplayPhotoBytes(id: string): Promise<void> {
  if (!isDisplayPhotoId(id)) return;
  if (inDatabase()) {
    await prisma.displayPhotoBlob.deleteMany({ where: { id } });
    return;
  }
  await unlink(path.join(LOCAL_DIR, id)).catch(() => {});
}
