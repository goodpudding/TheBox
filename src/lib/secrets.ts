import { createHash, timingSafeEqual } from "node:crypto";

/** Compare two secrets without leaking how much of one matched. */
export function secretsMatch(
  given: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * A shared secret from the environment. Outside production the documented
 * placeholder stands in when nothing is set. On the live site the placeholder
 * never counts, even if it was deployed by mistake: it is in the README.
 */
export function configuredSecret(name: string, devPlaceholder: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (process.env.NODE_ENV === "production") {
    return value === devPlaceholder ? "" : value;
  }
  return value || devPlaceholder;
}
