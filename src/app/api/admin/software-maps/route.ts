import { NextRequest, NextResponse, connection } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffRequest } from "@/lib/workstation/server";
import { jsonError } from "@/lib/workstation/errors";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await connection();
  const staff = await isStaffRequest(request);
  if (!staff) {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const maps = await prisma.machineSoftwareMap.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ maps });
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
      machineId?: string | null;
      workstationId?: string | null;
      displayName?: string;
      exeName?: string;
      exePath?: string | null;
      sortOrder?: number;
      active?: boolean;
    };
    if (!body.displayName || !body.exeName) {
      return NextResponse.json(
        { error: "displayName and exeName are required" },
        { status: 400 },
      );
    }
    const id = body.id ?? `map_${randomBytes(6).toString("hex")}`;
    const row = await prisma.machineSoftwareMap.upsert({
      where: { id },
      create: {
        id,
        machineId: body.machineId ?? null,
        workstationId: body.workstationId ?? null,
        displayName: body.displayName,
        exeName: body.exeName,
        exePath: body.exePath ?? null,
        sortOrder: body.sortOrder ?? 0,
        active: body.active ?? true,
      },
      update: {
        machineId: body.machineId ?? null,
        workstationId: body.workstationId ?? null,
        displayName: body.displayName,
        exeName: body.exeName,
        exePath: body.exePath ?? null,
        sortOrder: body.sortOrder ?? 0,
        active: body.active ?? true,
      },
    });
    return NextResponse.json({ map: row });
  } catch (err) {
    return jsonError(err);
  }
}
