import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffRequest } from "@/lib/workstation/server";
import { jsonError } from "@/lib/workstation/errors";
import { billingPayload } from "@/lib/workstation/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await connection();
  const staff = await isStaffRequest(request);
  if (!staff) {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const rows = await prisma.workstation.findMany({
    where: { deletedAt: null },
    include: {
      billedMachine: true,
      sessions: {
        where: { endedAt: null },
        include: { user: true },
      },
      softwareMaps: { where: { deletedAt: null } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    workstations: rows.map((w) => ({
      id: w.id,
      name: w.name,
      deviceId: w.deviceId,
      location: w.location,
      active: w.active,
      billedMachineId: w.billedMachineId,
      billedMachineName: w.billedMachine.name,
      billing: billingPayload(w.billedMachine),
      idleLockMinutes: w.idleLockMinutes,
      idleLogoutMinutes: w.idleLogoutMinutes,
      lastSeenAt: w.lastSeenAt?.toISOString() ?? null,
      openSession: w.sessions[0]
        ? {
            id: w.sessions[0].id,
            userId: w.sessions[0].userId,
            displayName: w.sessions[0].user.displayName,
            startedAt: w.sessions[0].startedAt.toISOString(),
          }
        : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const staff = await isStaffRequest(request);
    if (!staff) {
      return NextResponse.json({ error: "Staff only" }, { status: 401 });
    }
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      deviceId?: string;
      location?: string;
      billedMachineId?: string;
      idleLockMinutes?: number;
      idleLogoutMinutes?: number;
      active?: boolean;
    };
    if (!body.name || !body.deviceId || !body.billedMachineId) {
      return NextResponse.json(
        { error: "name, deviceId, and billedMachineId are required" },
        { status: 400 },
      );
    }
    const id = body.id ?? `ws_${randomBytes(6).toString("hex")}`;
    const row = await prisma.workstation.upsert({
      where: { id },
      create: {
        id,
        name: body.name,
        deviceId: body.deviceId,
        location: body.location ?? "",
        billedMachineId: body.billedMachineId,
        idleLockMinutes: body.idleLockMinutes ?? 10,
        idleLogoutMinutes: body.idleLogoutMinutes ?? 30,
        active: body.active ?? true,
      },
      update: {
        name: body.name,
        deviceId: body.deviceId,
        location: body.location ?? "",
        billedMachineId: body.billedMachineId,
        idleLockMinutes: body.idleLockMinutes ?? 10,
        idleLogoutMinutes: body.idleLogoutMinutes ?? 30,
        active: body.active ?? true,
      },
    });
    return NextResponse.json({ workstation: row });
  } catch (err) {
    return jsonError(err);
  }
}
