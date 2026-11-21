/**
 * Turns a database error into a sentence staff can act on.
 *
 * The data API answers with the message of whatever a method throws, which is
 * right for the app's own errors ("Class is full"). A Prisma error's message
 * is the failed query, argument by argument, and none of that belongs on a
 * phone screen. The full error goes to the server log instead.
 */

const FIELD_LABELS: Record<string, string> = {
  readerKey: "reader key",
  email: "email address",
  slug: "page address",
  assetTag: "asset tag",
  deviceId: "device ID",
  sessionToken: "session",
};

const GENERIC = "That could not be saved. Please try again.";

function isDatabaseError(err: unknown): err is Error & { code?: string } {
  if (!(err instanceof Error)) return false;
  if (err.name.startsWith("PrismaClient")) return true;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && /^P\d{4}$/.test(code);
}

/** A plain message for a database error, or null when it is not one. */
export function databaseErrorMessage(err: unknown): string | null {
  if (!isDatabaseError(err)) return null;
  if (err.code === "P2002") {
    const field = /Unique constraint failed on the fields: \(`([A-Za-z0-9_]+)`/.exec(
      err.message,
    )?.[1];
    const label = field ? (FIELD_LABELS[field] ?? null) : null;
    return label
      ? `That ${label} is already in use. Choose a different one.`
      : "That value is already in use. Choose a different one.";
  }
  return GENERIC;
}
