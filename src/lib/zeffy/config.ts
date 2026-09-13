/** Env helpers for Zeffy. Safe to call when keys are missing. */

export function getZeffyApiKey(): string | null {
  const key = process.env.ZEFFY_API_KEY?.trim();
  return key || null;
}

export function getZeffyWebhookSecret(): string | null {
  const secret = process.env.ZEFFY_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export function isZeffyConfigured(): boolean {
  return Boolean(getZeffyApiKey());
}

export function isZeffyWebhookConfigured(): boolean {
  return Boolean(getZeffyWebhookSecret());
}

export const ZEFFY_API_BASE =
  process.env.ZEFFY_API_BASE?.trim() || "https://api.zeffy.com/api/v1";

/** System actor recorded on bookings paid via Zeffy webhook/sync. */
export const ZEFFY_SYSTEM_ACTOR_ID = "system:zeffy";
