import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { devToolsLocked } from "@/lib/data/rpc-policy";
import { putPhoto } from "@/lib/inventory/storage";
import { validatePhotoUpload } from "@/lib/inventory/upload-policy";

export const runtime = "nodejs";

/**
 * Who may upload. The live site needs a signed-in member who is not
 * suspended. Local dev and demo builds run on fixtures with no session, so
 * the Dev toolbar user is allowed through there.
 */
async function uploadDenied(): Promise<NextResponse | null> {
  if (!devToolsLocked()) return null;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!row || row.deletedAt) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (row.status === "suspended") {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }
  return null;
}

async function readPhoto(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return { bytes, check: validatePhotoUpload(bytes) };
}

export async function POST(request: NextRequest) {
  const denied = await uploadDenied();
  if (denied) return denied;

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
  const thumb = form.get("thumb");

  // Check both files before anything is written to storage.
  const main = await readPhoto(file);
  if (!main.check.ok) {
    return NextResponse.json(
      { error: main.check.error },
      { status: main.check.status },
    );
  }
  const small = thumb instanceof File ? await readPhoto(thumb) : null;
  if (small && !small.check.ok) {
    return NextResponse.json(
      { error: small.check.error },
      { status: small.check.status },
    );
  }

  const kind = String(form.get("kind") ?? "OTHER")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32) || "other";
  const stored = await putPhoto({
    bytes: main.bytes,
    mimeType: main.check.mimeType,
    filename: file.name || `${kind}.jpg`,
    folder: "temp",
  });
  let thumbKey: string | null = null;
  if (small && small.check.ok) {
    const thumbStored = await putPhoto({
      bytes: small.bytes,
      mimeType: small.check.mimeType,
      filename: `thumb-${file.name || "photo.jpg"}`,
      folder: "temp",
    });
    thumbKey = thumbStored.storageKey;
  }
  return NextResponse.json({
    storageKey: stored.storageKey,
    thumbKey: thumbKey ?? stored.storageKey,
    mimeType: main.check.mimeType,
  });
}
