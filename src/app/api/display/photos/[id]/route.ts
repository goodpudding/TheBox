import { NextResponse } from "next/server";
import {
  deleteDisplayPhotoBytes,
  getDisplayPhotoBytes,
  isDisplayPhotoId,
} from "@/lib/display/photo-store";
import { staffOnly } from "@/lib/display/staff-guard";
import { PHOTO_CSP } from "@/lib/security-headers";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * One lobby display picture. No sign-in: these are pictures staff chose to
 * show on a screen facing the street, and the id cannot be guessed. A picture
 * never changes once stored, so the kiosk may keep its copy.
 */
export async function GET(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isDisplayPhotoId(id)) return notFound();
  const photo = await getDisplayPhotoBytes(id);
  if (!photo) return notFound();

  return new NextResponse(photo.bytes as BodyInit, {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": PHOTO_CSP,
    },
  });
}

/** Remove a picture's bytes. The row that described it is deleted separately. */
export async function DELETE(_request: Request, ctx: Context) {
  const denied = await staffOnly();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isDisplayPhotoId(id)) return notFound();
  await deleteDisplayPhotoBytes(id);
  return new NextResponse(null, { status: 204 });
}
