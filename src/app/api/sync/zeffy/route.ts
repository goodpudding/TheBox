import { NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import { secretsMatch } from "@/lib/secrets";
import {
  archiveCsvClasses,
  lastClassSyncAt,
  runClassSync,
} from "@/lib/sync/run";

export const runtime = "nodejs";

async function allowed(request: Request): Promise<boolean> {
  const secret = process.env.SYNC_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (secretsMatch(bearer, secret)) return true;
  const session = await auth();
  const role = session?.user?.role;
  return role === "staff" || role === "admin";
}

export async function GET(request: Request) {
  await connection();
  if (!(await allowed(request))) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const lastSyncedAt = await lastClassSyncAt();
  return NextResponse.json({ lastSyncedAt });
}

export async function POST(request: Request) {
  await connection();
  if (!(await allowed(request))) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  let archive = false;
  try {
    const body = (await request.clone().json()) as { archiveCsv?: boolean };
    archive = Boolean(body.archiveCsv);
  } catch {
    archive = false;
  }
  if (archive) {
    const result = await archiveCsvClasses();
    return NextResponse.json(result);
  }
  const result = await runClassSync();
  return NextResponse.json(result);
}
