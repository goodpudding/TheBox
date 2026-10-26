import { NextResponse } from "next/server";

export function jsonError(err: unknown) {
  const status =
    typeof err === "object" && err && "status" in err
      ? Number((err as { status?: number }).status) || 400
      : 400;
  const message = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: message }, { status });
}
