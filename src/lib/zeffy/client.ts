import {
  ZEFFY_API_BASE,
  getZeffyApiKey,
} from "@/lib/zeffy/config";
import type {
  ZeffyCampaign,
  ZeffyListResponse,
  ZeffyPayment,
} from "@/lib/zeffy/types";

export class ZeffyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ZeffyApiError";
  }
}

async function zeffyFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = getZeffyApiKey();
  if (!apiKey) {
    throw new ZeffyApiError(
      "ZEFFY_API_KEY is not set. Add it in Vercel/env when you have Zeffy access.",
      0,
    );
  }

  const url = path.startsWith("http") ? path : `${ZEFFY_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    throw new ZeffyApiError(
      `Zeffy API ${res.status} for ${path}`,
      res.status,
      json,
    );
  }

  return json as T;
}

export async function listZeffyCampaigns(options?: {
  cursor?: string;
  limit?: number;
}): Promise<ZeffyListResponse<ZeffyCampaign>> {
  const params = new URLSearchParams();
  if (options?.cursor) params.set("starting_after", options.cursor);
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  return zeffyFetch(`/campaigns${qs ? `?${qs}` : ""}`);
}

export async function getZeffyCampaign(
  id: string,
): Promise<ZeffyCampaign> {
  return zeffyFetch(`/campaigns/${encodeURIComponent(id)}`);
}

export async function listZeffyPayments(options?: {
  campaignId?: string;
  cursor?: string;
  limit?: number;
  createdGte?: number;
}): Promise<ZeffyListResponse<ZeffyPayment>> {
  const params = new URLSearchParams();
  if (options?.campaignId) params.set("campaign", options.campaignId);
  if (options?.cursor) params.set("starting_after", options.cursor);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.createdGte != null) {
    params.set("created[gte]", String(options.createdGte));
  }
  const qs = params.toString();
  return zeffyFetch(`/payments${qs ? `?${qs}` : ""}`);
}

/** Page through all campaigns (respects 100 req/min soft limit with small delays). */
export async function listAllZeffyCampaigns(): Promise<ZeffyCampaign[]> {
  const all: ZeffyCampaign[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await listZeffyCampaigns({ cursor, limit: 100 });
    all.push(...(page.data ?? []));
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return all;
}
