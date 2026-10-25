import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 32;

/** Fixture members only. Never a production PIN. */
export const DEMO_KIOSK_PIN = "2468";

export function normalizePin(pin: string): string {
  return pin.replace(/\s+/g, "");
}

export function isValidPinShape(pin: string): boolean {
  return /^\d{4,8}$/.test(normalizePin(pin));
}

export async function hashKioskPin(pin: string): Promise<string> {
  const normalized = normalizePin(pin);
  const salt = randomBytes(16);
  const key = (await scryptAsync(normalized, salt, KEYLEN)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyKioskPin(
  pin: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  const normalized = normalizePin(pin);
  const [scheme, saltHex, keyHex] = hash.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scryptAsync(
    normalized,
    salt,
    expected.length,
  )) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
