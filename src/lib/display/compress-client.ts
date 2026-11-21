"use client";

import { resizeBlob } from "@/lib/inventory/compress-client";
import { MAX_DISPLAY_PHOTO_BYTES } from "./limits";

/** Long edge and JPEG quality to try, largest first. The TV is 1920 wide. */
const ATTEMPTS: ReadonlyArray<readonly [edge: number, quality: number]> = [
  [1600, 0.8],
  [1280, 0.7],
  [1024, 0.6],
];

/**
 * Shrink a photo for the lobby display before it is uploaded. A phone photo
 * is several megabytes and the display stores at most 1.4 MB, so this tries
 * smaller sizes until one fits. Throws when the file is not a picture the
 * browser can read.
 */
export async function compressDisplayPhoto(
  file: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  for (const [edge, quality] of ATTEMPTS) {
    const result = await resizeBlob(file, edge, quality);
    if (result.blob.size <= MAX_DISPLAY_PHOTO_BYTES) return result;
  }
  throw new Error("still too large after shrinking");
}

/** Shrink and upload one picture. Returns where the display loads it from. */
export async function uploadDisplayPicture(file: Blob): Promise<{
  id: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
}> {
  let shrunk: Awaited<ReturnType<typeof compressDisplayPhoto>>;
  try {
    shrunk = await compressDisplayPhoto(file);
  } catch (err) {
    const tooLarge = err instanceof Error && /too large/.test(err.message);
    throw new Error(
      tooLarge
        ? "is still too large after shrinking"
        : "is not a picture this page can read",
    );
  }
  const body = new FormData();
  body.set("file", shrunk.blob, "photo.jpg");
  const res = await fetch("/api/display/photos", { method: "POST", body });
  const data = (await res.json().catch(() => null)) as
    | { id?: string; url?: string; mimeType?: string; error?: string }
    | null;
  if (!res.ok || !data?.id || !data.url || !data.mimeType) {
    throw new Error(data?.error ?? "could not be uploaded");
  }
  return {
    id: data.id,
    url: data.url,
    mimeType: data.mimeType,
    width: shrunk.width,
    height: shrunk.height,
  };
}
