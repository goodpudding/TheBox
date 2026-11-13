import { NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import {
  createServerDataProvider,
  lastProviderLoad,
} from "@/lib/data/factory";
import { handleDataRpc } from "@/lib/data/rpc-policy";

export const runtime = "nodejs";

/** Largest legitimate call is a staff CSV import or a lesson body. */
const MAX_BODY_BYTES = 1_000_000;

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
}

function requestMeta(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: (request.headers.get("cf-connecting-ip") ?? forwarded ?? "").slice(0, 64),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 512),
  };
}

export async function POST(request: Request) {
  await connection();
  const started = Date.now();
  let method = "unknown";
  const log = () =>
    console.info(
      JSON.stringify({
        rpc: method,
        ms: Date.now() - started,
        queries: lastProviderLoad(),
      }),
    );
  try {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return fail(413, "Request is too large");
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return fail(413, "Request is too large");
    }
    let body: { method?: unknown; args?: unknown };
    try {
      body = JSON.parse(text) as { method?: unknown; args?: unknown };
    } catch {
      return fail(400, "Invalid JSON");
    }
    if (!body || typeof body !== "object") {
      return fail(400, "method and args are required");
    }
    method = typeof body.method === "string" ? body.method.slice(0, 80) : "unknown";
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const provider = await createServerDataProvider(userId);
    const sessionUser = userId ? await provider.getCurrentUser() : null;
    const response = await handleDataRpc({
      method: body.method,
      args: body.args,
      sessionUser,
      provider,
      requestMeta: requestMeta(request),
    });
    log();
    return NextResponse.json(response.body, {
      status: response.status,
      headers: NO_STORE,
    });
  } catch (err) {
    // Database and runtime errors stay in the Worker log. The browser gets a
    // plain message; domain errors are returned by handleDataRpc as ok:false.
    console.error(JSON.stringify({ rpc: method, error: String(err) }));
    log();
    return fail(500, "Something went wrong. Please try again.");
  }
}
