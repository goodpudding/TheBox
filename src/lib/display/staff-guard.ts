import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/data/access";
import { devToolsLocked } from "@/lib/data/rpc-policy";
import { mapUserRow } from "@/lib/workstation/mappers";

/**
 * Null when the caller may change the lobby display, otherwise the refusal to
 * send. The live site needs a signed-in staff member. Local dev and demo
 * builds run on fixtures with no session, so everyone is let through there.
 */
export async function staffOnly(): Promise<NextResponse | null> {
  if (!devToolsLocked()) return null;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const row = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!row || row.deletedAt || !isStaffRole(mapUserRow(row))) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }
  return null;
}
