import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { hashKioskPin } from "@/lib/workstation/pin";
import { kioskPinPolicyError } from "@/lib/workstation/pin-policy";
import { recordPinSet } from "@/lib/workstation/pin-throttle";
import { jsonError } from "@/lib/workstation/errors";
import { memberActorId } from "@/lib/workstation/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const userId = await memberActorId(request);
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { kioskPinHash: true, kioskPinMustChange: true },
    });
    return NextResponse.json({
      pinSet: Boolean(row?.kioskPinHash),
      mustChange: Boolean(row?.kioskPinMustChange),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const userId = await memberActorId(request);
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = (await request.json()) as { pin?: string };
    const problem = kioskPinPolicyError(body.pin ?? "");
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const member = await prisma.user.update({
      where: { id: userId },
      data: {
        kioskPinHash: await hashKioskPin(body.pin ?? ""),
        kioskPinMustChange: false,
      },
    });
    // The member is signed in to their account here, so wrong PINs typed
    // against their email before this stop counting toward a lock.
    await recordPinSet({
      email: member.email,
      userId,
      entityId: "account",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
