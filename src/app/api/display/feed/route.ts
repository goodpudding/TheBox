import { NextRequest, NextResponse } from "next/server";
import { createServerDataProvider } from "@/lib/data/factory";

function tokenIsValid(token: string | null): boolean {
  const expected =
    process.env.DISPLAY_TOKEN?.trim() ||
    (process.env.NODE_ENV !== "production"
      ? "dev-display-token-change-me"
      : "");
  if (!expected || !token) return false;
  return token === expected;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!tokenIsValid(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = await createServerDataProvider(null);
  const feed = await provider.getDisplayFeed();
  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
