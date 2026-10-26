import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { hashKioskPin } from "@/lib/workstation/pin";
import { kioskPinPolicyError } from "@/lib/workstation/pin-policy";
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
    const problem = kioskPinPolicyError(body.pin ?? "");
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: actor.user.id },
      data: {
        kioskPinHash: await hashKioskPin(body.pin ?? ""),
        kioskPinMustChange: false,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
