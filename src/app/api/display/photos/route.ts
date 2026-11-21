import { NextRequest, NextResponse } from "next/server";
import {
  MAX_DISPLAY_PHOTO_BYTES,
  putDisplayPhotoBytes,
} from "@/lib/display/photo-store";
import { staffOnly } from "@/lib/display/staff-guard";
import { validatePhotoUpload } from "@/lib/inventory/upload-policy";

export const runtime = "nodejs";

const TOO_LARGE =
  "The photo is too large. The page shrinks photos before sending them; try a different one.";

/**
 * Store one picture for the lobby display: a rotating photo or a promo image.
 * The caller then saves the row that describes it. Staff only.
 */
export async function POST(request: NextRequest) {
  const denied = await staffOnly();
  if (denied) return denied;

  // A multipart body is a little larger than the file inside it.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_DISPLAY_PHOTO_BYTES + 64_000) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_DISPLAY_PHOTO_BYTES) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }
  const check = validatePhotoUpload(bytes);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await putDisplayPhotoBytes(bytes);
  return NextResponse.json(
    { id, mimeType: check.mimeType, url: `/api/display/photos/${id}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
