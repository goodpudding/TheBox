import type { DataProvider } from "./provider";

export const SIGNED_OUT_EVENT = "thebox:signed-out";

async function rpc(method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch("/api/data", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args }),
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: unknown;
    error?: string;
  } | null;
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body.result;
}

/** Browser DataProvider. Every method is a POST to `/api/data`. */
export function createRemoteDataProvider(): DataProvider {
  return new Proxy({} as DataProvider, {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;
      return (...args: unknown[]) => rpc(prop, args);
    },
  });
}
