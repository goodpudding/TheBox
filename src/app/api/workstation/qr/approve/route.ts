import { NextRequest, NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import { approveQrChallenge, authenticatePin } from "@/lib/workstation/server";
import { jsonError } from "@/lib/workstation/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = (await request.json()) as {
      challengeId?: string;
      email?: string;
      pin?: string;
    };
    if (!body.challengeId) {
      return NextResponse.json(
        { error: "challengeId is required" },
        { status: 400 },
      );
    }

    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && body.email && body.pin) {
      const user = await authenticatePin(body.email, body.pin);
      userId = user.id;
    }
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in on this phone or enter your PIN to approve" },
        { status: 401 },
      );
    }
    await approveQrChallenge({ challengeId: body.challengeId, userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
