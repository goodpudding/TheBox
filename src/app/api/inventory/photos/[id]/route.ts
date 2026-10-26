import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/inventory/storage";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const storageKey = decodeURIComponent(id);
  const photo = await getPhoto(storageKey);
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
