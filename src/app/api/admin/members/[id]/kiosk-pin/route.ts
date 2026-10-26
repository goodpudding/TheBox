import { NextRequest, NextResponse, connection } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashKioskPin } from "@/lib/workstation/pin";
import { kioskPinPolicyError } from "@/lib/workstation/pin-policy";
import { jsonError } from "@/lib/workstation/errors";
import { isStaffRequest } from "@/lib/workstation/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection();
  try {
    const staff = await isStaffRequest(request);
    if (!staff) {
      return NextResponse.json({ error: "Staff only" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = (await request.json()) as { temporaryPin?: string };
    const problem = kioskPinPolicyError(body.temporaryPin ?? "");
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const member = await prisma.user.findUnique({ where: { id } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    await prisma.user.update({
      where: { id },
      data: {
        kioskPinHash: await hashKioskPin(body.temporaryPin ?? ""),
        kioskPinMustChange: true,
      },
    });
    await prisma.auditEvent.create({
      data: {
        id: `audit_${randomBytes(8).toString("hex")}`,
        action: "member.pin_reset",
        actorId: staff.id,
        subjectUserId: id,
        entityType: "user",
        entityId: id,
        metadata: JSON.stringify({ mustChange: true }),
        occurredAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
