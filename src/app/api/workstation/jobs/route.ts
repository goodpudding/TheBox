import { NextRequest, NextResponse, connection } from "next/server";
import { requireWorkstationActor } from "@/lib/workstation/server";
import { recordEquipmentJob } from "@/lib/workstation/jobs";
import { memberMePayload } from "@/lib/workstation/payload";
import { jsonError } from "@/lib/workstation/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const actor = await requireWorkstationActor(request);
    const body = (await request.json()) as {
      machineId?: string;
      filamentGrams?: number;
      filamentCentsPerKg?: number;
      sheets?: number;
      prints?: number;
      runtimeSeconds?: number;
      note?: string;
    };
    if (!body.machineId) {
      return NextResponse.json(
        { error: "machineId is required" },
        { status: 400 },
      );
    }
    const job = await recordEquipmentJob({
      userId: actor.user.id,
      machineId: body.machineId,
      workstationId: actor.workstation.id,
      workstationSessionId: actor.session.id,
      filamentGrams: body.filamentGrams,
      filamentCentsPerKg: body.filamentCentsPerKg,
      sheets: body.sheets,
      prints: body.prints,
      runtimeSeconds: body.runtimeSeconds,
      source: "manual",
      note: body.note,
    });
    const me = await memberMePayload({
      userId: actor.user.id,
      session: actor.session,
      workstation: actor.workstation,
    });
    return NextResponse.json({ job, me });
  } catch (err) {
    return jsonError(err);
  }
}
