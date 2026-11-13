import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/inventory/storage";
import { isServablePhotoType } from "@/lib/inventory/upload-policy";
import { PHOTO_CSP } from "@/lib/security-headers";

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let storageKey: string;
  try {
    storageKey = decodeURIComponent(id);
  } catch {
    return notFound();
  }
  const photo = await getPhoto(storageKey);
  if (!photo) return notFound();

  // Fixture placeholders are SVG built on the server. Anything that came from
  // storage must be a raster image, so a stray HTML or SVG file is never
  // served from this origin.
  const generated = storageKey.startsWith("fixture:");
  if (!generated && !isServablePhotoType(photo.mimeType)) return notFound();

  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": PHOTO_CSP,
    },
  });
}
