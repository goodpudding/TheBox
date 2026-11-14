import { NextRequest, NextResponse, connection } from "next/server";
import { loginWithPin } from "@/lib/workstation/server";
import { memberMePayload } from "@/lib/workstation/payload";
import { jsonError } from "@/lib/workstation/errors";
import {
  RATE_LIMIT_MESSAGE,
  allowRequest,
  clientIp,
  ipLimitKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  // No sign-in here, and every wrong PIN counts against the email it names.
  if (!(await allowRequest("pinAttempt", ipLimitKey(clientIp(request))))) {
    console.warn(JSON.stringify({ route: "workstation/login", limited: "pinAttempt" }));
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      { status: 429, headers: rateLimitHeaders("pinAttempt") },
    );
  }
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
      mustChangePin: started.mustChangePin,
      me,
    });
  } catch (err) {
    return jsonError(err);
  }
}
