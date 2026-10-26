import { NextRequest, NextResponse } from "next/server";
import { putPhoto } from "@/lib/inventory/storage";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const kind = String(form.get("kind") ?? "OTHER");
  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await putPhoto({
    bytes,
    mimeType: file.type || "image/jpeg",
    filename: file.name || `${kind.toLowerCase()}.jpg`,
    folder: "temp",
  });
  let thumbKey: string | null = null;
  const thumb = form.get("thumb");
  if (thumb instanceof File) {
    const thumbBytes = Buffer.from(await thumb.arrayBuffer());
    const thumbStored = await putPhoto({
      bytes: thumbBytes,
      mimeType: thumb.type || "image/jpeg",
      filename: `thumb-${file.name || "photo.jpg"}`,
      folder: "temp",
    });
    thumbKey = thumbStored.storageKey;
  }
  return NextResponse.json({
    storageKey: stored.storageKey,
    thumbKey: thumbKey ?? stored.storageKey,
    mimeType: file.type || "image/jpeg",
  });
}
