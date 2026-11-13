/**
 * Signed quiz attempt tokens.
 *
 * The live site builds a new data provider for every request, so a token kept
 * in the provider's memory is gone by the time the member submits. The token
 * now carries the attempt itself (who, which module, which questions, when)
 * and an HMAC, so any request can check it.
 *
 * Uses Web Crypto so the same code runs in Workers, Node, and the fixture UI
 * in the browser.
 */

export interface QuizTokenPayload {
  userId: string;
  moduleId: string;
  questionIds: string[];
  startedAt: string;
  attemptNumber: number;
}

/** A started attempt must be submitted within this long. */
export const QUIZ_TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const PREFIX = "quiz";

/** Fixture mode has no secret. One random key per page or process is enough there. */
let fallbackSecret: string | null = null;

function secret(): string {
  const configured =
    typeof process !== "undefined" ? process.env.AUTH_SECRET?.trim() : "";
  if (configured) return configured;
  fallbackSecret ??= crypto.randomUUID() + crypto.randomUUID();
  return fallbackSecret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signQuizToken(payload: QuizTokenPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(`${PREFIX}.${body}`),
  );
  return `${PREFIX}.${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The payload when the token is intact and not too old, else null. */
export async function readQuizToken(
  token: unknown,
  now = Date.now(),
): Promise<QuizTokenPayload | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, body, sig] = parts as [string, string, string];
  const signature = fromBase64Url(sig);
  const bodyBytes = fromBase64Url(body);
  if (!signature || !bodyBytes) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    signature as BufferSource,
    new TextEncoder().encode(`${PREFIX}.${body}`),
  );
  if (!valid) return null;
  let payload: QuizTokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as QuizTokenPayload;
  } catch {
    return null;
  }
  if (
    typeof payload?.userId !== "string" ||
    typeof payload.moduleId !== "string" ||
    typeof payload.startedAt !== "string" ||
    !Array.isArray(payload.questionIds) ||
    !payload.questionIds.every((id) => typeof id === "string")
  ) {
    return null;
  }
  const started = new Date(payload.startedAt).getTime();
  if (!Number.isFinite(started) || now - started > QUIZ_TOKEN_MAX_AGE_MS) {
    return null;
  }
  return payload;
}
