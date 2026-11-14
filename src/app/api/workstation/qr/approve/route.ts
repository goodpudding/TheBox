import { NextRequest, NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import {
  approveQrChallenge,
  authenticatePin,
  requireOpenQrChallenge,
} from "@/lib/workstation/server";
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
      // Same allowance as the desk sign-in: this is the other way to try a PIN.
      if (!(await allowRequest("pinAttempt", ipLimitKey(clientIp(request))))) {
        console.warn(
          JSON.stringify({ route: "workstation/qr/approve", limited: "pinAttempt" }),
        );
        return NextResponse.json(
          { error: RATE_LIMIT_MESSAGE },
          { status: 429, headers: rateLimitHeaders("pinAttempt") },
        );
      }
      // This route needs no sign-in, and wrong PINs lock the email at every
      // desk. Only take a PIN against a QR code a desk is showing right now.
      await requireOpenQrChallenge(body.challengeId);
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
