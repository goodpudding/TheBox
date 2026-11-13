import { NextRequest, NextResponse, connection } from "next/server";
import { requireWorkstationActor } from "@/lib/workstation/server";
import { recordEquipmentJob } from "@/lib/workstation/jobs";
import { memberMePayload } from "@/lib/workstation/payload";
import { jsonError } from "@/lib/workstation/errors";
import { parseJobRequest } from "@/lib/workstation/job-input";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const actor = await requireWorkstationActor(request);
    const parsed = parseJobRequest(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    // The filament price is the shop's, set in src/lib/credits.ts. It is not
    // read from the request.
    const job = await recordEquipmentJob({
      userId: actor.user.id,
      machineId: parsed.job.machineId,
      workstationId: actor.workstation.id,
      workstationSessionId: actor.session.id,
      filamentGrams: parsed.job.filamentGrams,
      prints: parsed.job.prints,
      runtimeSeconds: parsed.job.runtimeSeconds,
      source: "manual",
      note: parsed.job.note,
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
