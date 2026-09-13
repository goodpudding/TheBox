import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify `Zeffy-Signature: t=<unix>,v1=<hex>` against the raw body.
 * https://www.zeffy.com/api/docs — Webhook signatures
 */
export function verifyZeffySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): { ok: true } | { ok: false; reason: string } {
  if (!signatureHeader?.trim()) {
    return { ok: false, reason: "missing_signature_header" };
  }
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((piece) => {
      const [k, ...rest] = piece.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string | undefined>;

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) {
    return { ok: false, reason: "malformed_signature_header" };
  }

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}

/** Test helper: build a valid signature header for a body. */
export function signZeffyPayload(
  rawBody: string,
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${v1}`;
}
