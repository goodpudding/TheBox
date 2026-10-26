import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { evaluateLaunchAccess, requireWorkstationActor } from "@/lib/workstation/server";
import { jsonError } from "@/lib/workstation/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const actor = await requireWorkstationActor(request);
    const body = (await request.json()) as {
      machineId?: string | null;
      softwareMapId?: string;
    };
    if (!body.softwareMapId) {
      return NextResponse.json(
        { error: "softwareMapId is required" },
        { status: 400 },
      );
    }
    const map = await prisma.machineSoftwareMap.findUnique({
      where: { id: body.softwareMapId },
    });
    if (!map || !map.active) {
      return NextResponse.json({ error: "Unknown software map" }, { status: 404 });
    }
    const machineId = body.machineId ?? map.machineId;
    let allow = true;
    let reason = "ok";
    if (machineId) {
      const access = await evaluateLaunchAccess({
        user: actor.user,
        machineId,
      });
      allow = access.allow;
      reason = access.reason;
    }
    await prisma.workstationLaunch.create({
      data: {
        id: `wsl_${randomBytes(8).toString("hex")}`,
        workstationId: actor.workstation.id,
        sessionId: actor.session.id,
        userId: actor.user.id,
        machineId: machineId ?? actor.session.billedMachineId,
        softwareMapId: map.id,
        allowed: allow,
        reason,
        exeName: map.exeName,
      },
    });
    if (!allow) {
      return NextResponse.json(
        {
          allowed: false,
          reason,
          honorLock: false,
          note: "Launch blocked by membership, waiver, cert, or reservation — not by a power lock.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json({
      allowed: true,
      reason: "ok",
      launch: {
        displayName: map.displayName,
        exeName: map.exeName,
        exePath: map.exePath,
      },
      honorLock: false,
      note: "This records intent and opens the app. It is not a machine lock. Logout does not cancel prints.",
    });
  } catch (err) {
    return jsonError(err);
  }
}
