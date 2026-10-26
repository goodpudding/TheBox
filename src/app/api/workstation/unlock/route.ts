import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { verifyKioskPin } from "@/lib/workstation/pin";
import { jsonError } from "@/lib/workstation/errors";
import { getWorkstationActor } from "@/lib/workstation/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const actor = await getWorkstationActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Not signed in at this workstation" }, { status: 401 });
    }
    const body = (await request.json()) as { pin?: string };
    const row = await prisma.user.findUnique({
      where: { id: actor.user.id },
      select: { kioskPinHash: true },
    });
    const ok = await verifyKioskPin(body.pin ?? "", row?.kioskPinHash);
    if (!ok) {
      return NextResponse.json({ error: "PIN didn't match" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
