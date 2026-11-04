import { NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/data/access";
import { mapUserRow } from "@/lib/workstation/mappers";

export const runtime = "nodejs";

const DEV_TOKEN = "dev-display-token-change-me";

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const row = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!row || !isStaffRole(mapUserRow(row))) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const token =
    process.env.DISPLAY_TOKEN?.trim() ||
    (process.env.NODE_ENV !== "production" ? DEV_TOKEN : "");
  if (!token) {
    return NextResponse.json(
      { error: "DISPLAY_TOKEN is not set on the Worker" },
      { status: 503 },
    );
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    new URL(request.url).origin;
  return NextResponse.json(
    { url: `${base}/display?token=${encodeURIComponent(token)}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
