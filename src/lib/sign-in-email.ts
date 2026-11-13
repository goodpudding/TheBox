/** Longest address the mail standards allow. */
const MAX_ADDRESS_LENGTH = 254;

// Letters, digits and accents in any script, plus the punctuation an address
// may carry unquoted. No spaces, brackets, commas, semicolons or quotes.
const NAME = "[\\p{L}\\p{M}\\p{N}!#$%&'*+/=?^_`{|}~.-]+";
const LABEL = "[\\p{L}\\p{M}\\p{N}-]+";
const BARE_ADDRESS = new RegExp(`^${NAME}@${LABEL}(?:\\.${LABEL})*$`, "u");

/**
 * The address a sign-in link may be sent to, as Auth.js stores it (lower
 * case, trimmed), or an error when it is anything but one bare address.
 *
 * Auth.js on its own lets "Any Name <pat@example.com>", "(note)pat@..." and
 * "x,pat@..." through and hands them to the mail service as written. Those
 * all reach pat, but each looks like a new mailbox to the sign-in limit and
 * to the user table. A browser's email field never produces them.
 */
export function normalizeSignInEmail(identifier: string): string {
  const text =
    typeof identifier === "string" ? identifier.normalize("NFKC").toLowerCase().trim() : "";
  if (!text || text.length > MAX_ADDRESS_LENGTH || !BARE_ADDRESS.test(text)) {
    throw new Error("Invalid email address format.");
  }
  return text;
}
