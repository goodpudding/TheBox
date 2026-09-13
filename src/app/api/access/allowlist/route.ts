import { NextRequest, NextResponse } from "next/server";
import {
  getAccessDataProvider,
  readerSecretIsValid,
} from "@/lib/access-api";

/**
 * GET /api/access/allowlist?readerKey=…
 * Optional offline cache for the reader.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-reader-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  if (!readerSecretIsValid(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const readerKey = request.nextUrl.searchParams.get("readerKey")?.trim();
  if (!readerKey) {
    return NextResponse.json(
      { error: "readerKey is required" },
      { status: 400 },
    );
  }

  try {
    const provider = await getAccessDataProvider();
    const allowlist = await provider.getAllowlist(readerKey);
    return NextResponse.json(allowlist, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown reader" },
      { status: 404 },
    );
  }
}
