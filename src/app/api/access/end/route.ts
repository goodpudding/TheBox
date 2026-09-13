import { NextRequest, NextResponse } from "next/server";
import {
  getAccessDataProvider,
  readerSecretIsValid,
} from "@/lib/access-api";

/**
 * POST /api/access/end
 * Body: { readerKey, sessionId }
 * Header: Authorization: Bearer <READER_SHARED_SECRET>
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-reader-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  if (!readerSecretIsValid(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { readerKey?: string; sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const readerKey = body.readerKey?.trim();
  const sessionId = body.sessionId?.trim();
  if (!readerKey || !sessionId) {
    return NextResponse.json(
      { error: "readerKey and sessionId are required" },
      { status: 400 },
    );
  }

  try {
    const provider = await getAccessDataProvider();
    const session = await provider.endAccess({ readerKey, sessionId });
    return NextResponse.json(
      { ok: true, sessionId: session.id, endedAt: session.endedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not end session" },
      { status: 400 },
    );
  }
}
