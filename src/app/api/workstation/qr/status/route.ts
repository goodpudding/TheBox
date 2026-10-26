import { NextRequest, NextResponse, connection } from "next/server";
import { consumeQrChallenge } from "@/lib/workstation/server";
import { memberMePayload } from "@/lib/workstation/payload";
import { jsonError } from "@/lib/workstation/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const challengeId = request.nextUrl.searchParams.get("challengeId");
    if (!challengeId) {
      return NextResponse.json(
        { error: "challengeId is required" },
        { status: 400 },
      );
    }
    const result = await consumeQrChallenge(challengeId);
    if (result.status !== "approved") {
      return NextResponse.json({ status: result.status });
    }
    const me = await memberMePayload({
      userId: result.session.userId,
      session: result.session,
      workstation: result.workstation,
    });
    return NextResponse.json({
      status: "approved",
      token: result.token,
      me,
    });
  } catch (err) {
    return jsonError(err);
  }
}
