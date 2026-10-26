import { NextRequest, NextResponse, connection } from "next/server";
import { isStaffRequest } from "@/lib/workstation/server";
import { refundEquipmentJob } from "@/lib/workstation/jobs";
import { jsonError } from "@/lib/workstation/errors";

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
    const job = await refundEquipmentJob({ jobId: id, actorId: staff.id });
    return NextResponse.json({ job });
  } catch (err) {
    return jsonError(err);
  }
}
