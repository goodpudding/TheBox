import { NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import {
  createServerDataProvider,
  lastProviderLoad,
} from "@/lib/data/factory";
import { handleDataRpc } from "@/lib/data/rpc-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await connection();
  const started = Date.now();
  let method = "unknown";
  try {
    const body = (await request.json()) as { method?: unknown; args?: unknown };
    method = typeof body.method === "string" ? body.method : "unknown";
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const provider = await createServerDataProvider(userId);
    const sessionUser = userId ? await provider.getCurrentUser() : null;
    const response = await handleDataRpc({
      method: body.method,
      args: body.args,
      sessionUser,
      provider,
    });
    console.info(
      JSON.stringify({
        rpc: method,
        ms: Date.now() - started,
        queries: lastProviderLoad(),
      }),
    );
    return NextResponse.json(response.body, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    console.info(
      JSON.stringify({
        rpc: method,
        ms: Date.now() - started,
        queries: lastProviderLoad(),
      }),
    );
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
