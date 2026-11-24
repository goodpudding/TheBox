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
