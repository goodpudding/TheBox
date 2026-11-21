import { NextResponse } from "next/server";
import { databaseErrorMessage } from "@/lib/data/db-errors";

export function jsonError(err: unknown) {
  // A database error's own message is the failed query. Staff get a sentence.
  const database = databaseErrorMessage(err);
  if (database) {
    console.error(JSON.stringify({ route: "workstation", databaseError: String(err) }));
    return NextResponse.json({ error: database }, { status: 400 });
  }
  const status =
    typeof err === "object" && err && "status" in err
      ? Number((err as { status?: number }).status) || 400
      : 400;
  const message = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: message }, { status });
}
