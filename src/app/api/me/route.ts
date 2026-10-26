import { NextRequest, NextResponse, connection } from "next/server";
import { getWorkstationActor } from "@/lib/workstation/server";
import { memberMePayload } from "@/lib/workstation/payload";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await connection();
  const actor = await getWorkstationActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const me = await memberMePayload({
    userId: actor.user.id,
    session: actor.session,
    workstation: actor.workstation,
  });
  return NextResponse.json(me, {
    headers: { "Cache-Control": "no-store" },
  });
}
