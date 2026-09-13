import { NextRequest, NextResponse } from "next/server";
import {
  getAccessDataProvider,
  normalizeBadgeUid,
  readerSecretIsValid,
} from "@/lib/access-api";

/**
 * POST /api/access/authorize
 * Body: { readerKey, badgeUid }
 * Header: Authorization: Bearer <READER_SHARED_SECRET>
 *      or X-Reader-Secret: <READER_SHARED_SECRET>
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-reader-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  if (!readerSecretIsValid(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { readerKey?: string; badgeUid?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const readerKey = body.readerKey?.trim();
  const badgeUid = body.badgeUid ? normalizeBadgeUid(body.badgeUid) : "";
  if (!readerKey || !badgeUid) {
    return NextResponse.json(
      { error: "readerKey and badgeUid are required" },
      { status: 400 },
    );
  }

  const provider = await getAccessDataProvider();
  const result = await provider.authorizeAccess({ readerKey, badgeUid });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
