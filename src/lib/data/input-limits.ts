/**
 * Limits for text that arrives from public forms. Every row is loaded on
 * later requests, so an unbounded field is a way to slow the whole site.
 */

export const NAME_MAX = 120;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 40;
export const MESSAGE_MAX = 4000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed text. Throws when missing or longer than `max`. */
export function requiredText(value: unknown, label: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max) {
    throw new Error(`${label} is too long (${max} characters at most)`);
  }
  return text;
}

/** Trimmed text or null. Throws when longer than `max`. */
export function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > max) {
    throw new Error(`${label} is too long (${max} characters at most)`);
  }
  return text;
}

/** Trimmed email. Throws when it is missing, malformed, or too long. */
export function requiredEmail(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > EMAIL_MAX || !EMAIL_PATTERN.test(text)) {
    throw new Error("A valid email is required");
  }
  return text;
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
