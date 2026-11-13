import { NextRequest, NextResponse, connection } from "next/server";
import { jsonError } from "@/lib/workstation/errors";
import { PIN_LOCK_MESSAGE } from "@/lib/workstation/pin-attempts";
import { getWorkstationActor, verifyPinLogin } from "@/lib/workstation/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const actor = await getWorkstationActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Not signed in at this workstation" }, { status: 401 });
    }
    const body = (await request.json()) as { pin?: string };
    // Same attempt limit as desk login, so the lock screen is not a place to
    // guess the PIN of whoever left the desk signed in.
    try {
      await verifyPinLogin({
        email: actor.user.email,
        pin: typeof body.pin === "string" ? body.pin : "",
        scope: actor.workstation.id,
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        return NextResponse.json({ error: PIN_LOCK_MESSAGE }, { status: 429 });
      }
      if (status === 401) {
        return NextResponse.json({ error: "PIN didn't match" }, { status: 401 });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
