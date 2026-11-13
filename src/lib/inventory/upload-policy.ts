/**
 * What an inventory photo upload may contain, and what the photo route may
 * serve back. Uploads are raster images only. SVG and HTML can carry script,
 * and the photo route serves from the portal's own origin.
 */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type PhotoMimeType = "image/jpeg" | "image/png" | "image/webp";

const SERVABLE = new Set<string>(["image/jpeg", "image/png", "image/webp"]);

/** Identify a raster image from its leading bytes. The declared type is ignored. */
export function sniffImageType(bytes: Uint8Array): PhotoMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

export type PhotoUploadCheck =
  | { ok: true; mimeType: PhotoMimeType }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function validatePhotoUpload(bytes: Uint8Array): PhotoUploadCheck {
  if (bytes.length === 0) {
    return { ok: false, status: 400, error: "The photo is empty." };
  }
  if (bytes.length > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, error: "The photo is too large." };
  }
  const mimeType = sniffImageType(bytes);
  if (!mimeType) {
    return {
      ok: false,
      status: 415,
      error: "Photos must be JPEG, PNG, or WebP images.",
    };
  }
  return { ok: true, mimeType };
}

export function isServablePhotoType(mimeType: string): boolean {
  return SERVABLE.has(mimeType.split(";")[0]!.trim().toLowerCase());
}
