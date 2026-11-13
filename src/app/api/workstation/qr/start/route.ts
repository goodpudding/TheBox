import { NextRequest, NextResponse, connection } from "next/server";
import QRCode from "qrcode";
import { startQrChallenge } from "@/lib/workstation/server";
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
  // No sign-in here and every start writes a row, so count per address first.
  if (!(await allowRequest("qrStart", ipLimitKey(clientIp(request))))) {
    console.warn(JSON.stringify({ route: "workstation/qr/start", limited: "qrStart" }));
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      { status: 429, headers: rateLimitHeaders("qrStart") },
    );
  }
  try {
    const body = (await request.json()) as { workstationId?: string };
    if (!body.workstationId) {
      return NextResponse.json(
        { error: "workstationId is required" },
        { status: 400 },
      );
    }
    const { challenge, workstation } = await startQrChallenge(body.workstationId);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      request.nextUrl.origin;
    const approveUrl = `${origin}/workstation/approve?challenge=${encodeURIComponent(challenge.id)}`;
    const qrDataUrl = await QRCode.toDataURL(approveUrl, {
      margin: 1,
      width: 280,
    });
    return NextResponse.json({
      challengeId: challenge.id,
      userCode: challenge.userCode,
      expiresAt: challenge.expiresAt.toISOString(),
      approveUrl,
      qrDataUrl,
      workstationName: workstation.name,
    });
  } catch (err) {
    return jsonError(err);
  }
}
