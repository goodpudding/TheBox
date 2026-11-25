/**
 * The text of a redemption code: how one is made, shown and read back.
 *
 * A code is 15 characters from 31 (no 0 or O, no 1, I or L), which is about
 * 74 bits. Nobody guesses one, even at the rate the redeem page allows.
 * Staff print them in three groups of five; people type them in any case,
 * with or without the dashes.
 */

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 15;
const GROUP = 5;

/** A new code, every character equally likely. */
export function generateCode(): string {
  const out: string[] = [];
  // 248 is the largest multiple of 31 a byte can reach. Bytes above it are
  // thrown away, or the first few characters would come up more often.
  const ceiling = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  while (out.length < CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2));
    for (const byte of bytes) {
      if (byte >= ceiling) continue;
      out.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]!);
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out.join("");
}

/** "ABCDE-FGHJK-MNPQR", for a card or a screen. */
export function formatCode(code: string): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += GROUP) groups.push(code.slice(i, i + GROUP));
  return groups.join("-");
}

/** What someone typed, as the code is stored: upper case, letters and digits only. */
export function normalizeCode(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .slice(0, 200)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 64);
}

/**
 * Gift card numbers. A printed card carries only a short number; staff type
 * it at the desk to find the code behind it. A number is short enough to
 * guess, so it never redeems anything on the member's own redeem page.
 */
export const MAX_CARD_NUMBER = 999_999;

/** "014": at least three digits, so 7 and 70 cannot be mistaken on a card. */
export function formatCardNumber(cardNumber: number): string {
  return String(cardNumber).padStart(3, "0");
}

/**
 * The card number in what staff typed ("014", "#14", "card 14"), or null
 * when it is not one. Anything with letters beyond a leading "card" is a
 * code, not a number.
 */
export function parseCardNumber(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const text = input
    .slice(0, 40)
    .trim()
    .replace(/^(?:gift\s*)?card\b/i, "")
    .replace(/^[\s#:.-]+/, "")
    .trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_CARD_NUMBER ? value : null;
}
