import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Website passwords: the rules for choosing one, and how one is stored.
 *
 * Stored as `scrypt:N:r:p:salt:key` (salt and key in hex). The settings are
 * written into every hash, so they can be raised later: an older hash still
 * checks with the settings it was made with, and is replaced the next time
 * its owner signs in (passwordHashIsCurrent).
 */

export const MIN_PASSWORD_LENGTH = 10;
/** Room for a long passphrase. A cap, so nobody can post megabytes to hash. */
export const MAX_PASSWORD_LENGTH = 200;

const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * N is the cost: memory is about 128 * N * r bytes (16 MB here) and time
 * grows with it. A Worker has 128 MB in all and the hash runs on its CPU
 * allowance, so this is the setting already proven by the shop PIN.
 */
const CURRENT = { N: 16384, r: 8, p: 1 } as const;

/** The most a stored hash may ask for, so a damaged row cannot stall a request. */
const LIMIT = { N: 131072, r: 16, p: 4 } as const;

type Settings = { N: number; r: number; p: number };

function derive(password: string, salt: Buffer, length: number, settings: Settings): Promise<Buffer> {
  const options: ScryptOptions = {
    ...settings,
    // Node refuses anything over 32 MB unless told otherwise.
    maxmem: 256 * settings.N * settings.r,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** One form for every way of typing the same characters. Spaces are kept. */
function normalizePassword(password: string): string {
  return password.normalize("NFKC");
}

/** Passwords that are tried first by anyone guessing. */
const COMMON_PASSWORDS = new Set([
  "1234567890",
  "0123456789",
  "12345678910",
  "1234567891",
  "0987654321",
  "9876543210",
  "1q2w3e4r5t",
  "qwertyuiop",
  "qwerty12345",
  "qwerty123456",
  "password12",
  "password123",
  "password1234",
  "passwordpassword",
  "iloveyou12",
  "iloveyou123",
  "letmein123",
  "welcome123",
  "welcome1234",
  "administrator",
  "makerspace",
  "makerspace1",
  "makerspace123",
  "discoverburien",
  "burienmakerspace",
]);

/** Null when the password may be used, else what to tell the member. */
export function passwordPolicyError(password: unknown, email = ""): string | null {
  if (typeof password !== "string") return "Enter a password.";
  const text = normalizePassword(password);
  const length = [...text].length;
  if (length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  const lower = text.toLowerCase();
  if (new Set(lower).size < 4 || COMMON_PASSWORDS.has(lower)) {
    return "That password is too easy to guess. Choose another.";
  }
  const address = email.normalize("NFKC").toLowerCase().trim();
  const name = address.split("@")[0];
  if (address && (lower === address || (name.length >= 4 && lower.includes(name)))) {
    return "Choose a password that does not contain your email.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(normalizePassword(password), salt, KEY_BYTES, CURRENT);
  return [
    "scrypt",
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString("hex"),
    key.toString("hex"),
  ].join(":");
}

type Parsed = { settings: Settings; salt: Buffer; key: Buffer };

function parseHash(hash: string | null | undefined): Parsed | null {
  if (!hash) return null;
  const [scheme, n, r, p, saltHex, keyHex, ...rest] = hash.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex || rest.length) return null;
  const settings = { N: Number(n), r: Number(r), p: Number(p) };
  const whole = (value: number, max: number) =>
    Number.isInteger(value) && value >= 1 && value <= max;
  if (!whole(settings.N, LIMIT.N) || !whole(settings.r, LIMIT.r) || !whole(settings.p, LIMIT.p)) {
    return null;
  }
  // scrypt only takes a power of two above 1.
  if (settings.N < 2 || (settings.N & (settings.N - 1)) !== 0) return null;
  const salt = Buffer.from(saltHex, "hex");
  const key = Buffer.from(keyHex, "hex");
  if (salt.length * 2 !== saltHex.length || key.length * 2 !== keyHex.length) return null;
  if (salt.length < 8 || key.length < 16 || key.length > 64) return null;
  return { settings, salt, key };
}

/** False for a wrong password and for a hash that cannot be read. Never throws. */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const parsed = parseHash(hash);
  if (!parsed || typeof password !== "string" || password.length > 4 * MAX_PASSWORD_LENGTH) {
    return false;
  }
  try {
    const actual = await derive(
      normalizePassword(password),
      parsed.salt,
      parsed.key.length,
      parsed.settings,
    );
    return actual.length === parsed.key.length && timingSafeEqual(actual, parsed.key);
  } catch (err) {
    console.error(JSON.stringify({ auth: "password", verify: String(err) }));
    return false;
  }
}

/** False when the hash was made with older settings and should be redone. */
export function passwordHashIsCurrent(hash: string): boolean {
  const parsed = parseHash(hash);
  if (!parsed) return false;
  const { N, r, p } = parsed.settings;
  return (
    N === CURRENT.N && r === CURRENT.r && p === CURRENT.p && parsed.key.length === KEY_BYTES
  );
}

let decoy: Promise<string> | undefined;

/**
 * Do the work of a password check when there is nothing to check against (no
 * such member, no password chosen, sign-in locked), so the time an answer
 * takes does not say which of those it was.
 */
export async function spendPasswordCheck(password: string): Promise<void> {
  decoy ??= hashPassword(randomBytes(24).toString("hex"));
  await verifyPassword(password, await decoy);
}
