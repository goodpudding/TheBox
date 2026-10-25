import { NextRequest, NextResponse, connection } from "next/server";
import { loginWithPin } from "@/lib/workstation/server";
import { memberMePayload } from "@/lib/workstation/payload";
import { jsonError } from "@/lib/workstation/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = (await request.json()) as {
      workstationId?: string;
      email?: string;
      pin?: string;
    };
    if (!body.workstationId || !body.email || !body.pin) {
      return NextResponse.json(
        { error: "workstationId, email, and pin are required" },
        { status: 400 },
      );
    }
    const started = await loginWithPin({
      workstationId: body.workstationId,
      email: body.email,
      pin: body.pin,
    });
    const me = await memberMePayload({
      userId: started.session.userId,
      session: started.session,
      workstation: started.workstation,
    });
    return NextResponse.json({
      token: started.token,
      me,
    });
  } catch (err) {
    return jsonError(err);
  }
}
