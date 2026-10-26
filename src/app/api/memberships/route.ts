import { NextResponse, connection } from "next/server";
import type { MembershipProduct } from "@/lib/data/types";
import { getZeffyApiKey, isZeffyConfigured } from "@/lib/zeffy/config";
import { ZeffyApiError } from "@/lib/zeffy/client";
import {
  getCachedZeffyMembershipCatalog,
  type ZeffyCatalogSkip,
} from "@/lib/zeffy/memberships";

export const runtime = "nodejs";

export type MembershipCatalogResponse = {
  source: "zeffy" | "fixtures";
  configured: boolean;
  products: MembershipProduct[];
  paymentUrl: string | null;
  note?: string;
  skipped?: ZeffyCatalogSkip[];
};

/**
 * Public membership catalog for /join.
 * Uses Zeffy when ZEFFY_API_KEY is set; otherwise the client falls back to fixtures.
 * Never returns contacts or other PII.
 */
export async function GET() {
  await connection();

  if (!isZeffyConfigured()) {
    const body: MembershipCatalogResponse = {
      source: "fixtures",
      configured: false,
      products: [],
      paymentUrl: null,
      note: "ZEFFY_API_KEY is not set. Showing fixture memberships.",
    };
    return NextResponse.json(body);
  }

  try {
    const catalog = await getCachedZeffyMembershipCatalog();
    if (!catalog.products.length) {
      const body: MembershipCatalogResponse = {
        source: "fixtures",
        configured: true,
        products: [],
        paymentUrl: catalog.primaryUrl,
        skipped: catalog.skipped,
        note:
          "Zeffy is connected but has no published membership rates yet. Showing fixture memberships.",
      };
      return NextResponse.json(body, {
        headers: { "Cache-Control": "private, max-age=60" },
      });
    }

    const body: MembershipCatalogResponse = {
      source: "zeffy",
      configured: true,
      products: catalog.products,
      paymentUrl: catalog.primaryUrl,
      skipped: catalog.skipped,
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    const message =
      err instanceof ZeffyApiError
        ? `Zeffy API ${err.status}: ${typeof err.body === "object" && err.body && "error" in (err.body as object) ? JSON.stringify(err.body) : err.message}`
        : err instanceof Error
          ? err.message
          : "Unknown Zeffy error";
    const body: MembershipCatalogResponse = {
      source: "fixtures",
      configured: Boolean(getZeffyApiKey()),
      products: [],
      paymentUrl: null,
      note: message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]"),
    };
    return NextResponse.json(body, { status: 200 });
  }
}
