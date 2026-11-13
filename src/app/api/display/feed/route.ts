import { NextRequest, NextResponse } from "next/server";
import { createServerDataProvider } from "@/lib/data/factory";
import { configuredSecret, secretsMatch } from "@/lib/secrets";

function tokenIsValid(token: string | null): boolean {
  return secretsMatch(
    token,
    configuredSecret("DISPLAY_TOKEN", "dev-display-token-change-me"),
  );
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
