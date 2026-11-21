import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/data/access";
import { devToolsLocked } from "@/lib/data/rpc-policy";
import { putPhoto } from "@/lib/inventory/storage";
import {
  PhotoRejectedError,
  validatePhotoUpload,
} from "@/lib/inventory/upload-policy";

export const runtime = "nodejs";

/**
 * A picture for a lobby promo slide. Staff only on the live site; local dev
 * and demo builds run on fixtures with no session. The picture is kept with
 * the other uploaded photos and served from the same route.
 */
export async function POST(request: NextRequest) {
  if (devToolsLocked()) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    if (!isStaffRole(session.user)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }
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
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validatePhotoUpload(bytes);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { storageKey } = await putPhoto({
      bytes,
      mimeType: check.mimeType,
      filename: "promo.jpg",
      folder: "promos",
    });
    return NextResponse.json({
      url: `/api/inventory/photos/${encodeURIComponent(storageKey)}`,
    });
  } catch (err) {
    if (err instanceof PhotoRejectedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(JSON.stringify({ route: "display/upload", error: String(err) }));
    return NextResponse.json(
      { error: "Could not save the picture. Please try again." },
      { status: 500 },
    );
  }
}
