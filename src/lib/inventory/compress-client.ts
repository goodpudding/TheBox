"use client";

import {
  INVENTORY_JPEG_QUALITY,
  INVENTORY_PHOTO_LONG_EDGE,
  INVENTORY_THUMB_LONG_EDGE,
} from "./config";

async function resizeBlob(
  file: Blob,
  maxEdge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not compress photo");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compress failed"))),
      "image/jpeg",
      quality,
    );
  });
  return { blob, width, height };
}

export async function compressInventoryPhoto(file: Blob): Promise<{
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}> {
  const full = await resizeBlob(file, INVENTORY_PHOTO_LONG_EDGE, INVENTORY_JPEG_QUALITY);
  const thumb = await resizeBlob(file, INVENTORY_THUMB_LONG_EDGE, INVENTORY_JPEG_QUALITY);
  return {
    full: full.blob,
    thumb: thumb.blob,
    width: full.width,
    height: full.height,
  };
}
