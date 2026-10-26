import { parseServiceAccount, type GoogleServiceAccount } from "@/lib/google/config";
import type { ClassSource } from "@/lib/data/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TIME_ZONE = "America/Los_Angeles";

export interface CalendarSession {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  capacity: number;
  zeffyUrl: string | null;
  location: string;
  source: ClassSource;
  googleEventId: string | null;
  googleCalendarId: string | null;
  cancelledAt: string | null;
  description?: string | null;
}

export interface CalendarIds {
  classes: string;
  community: string;
}

export type CalendarOp =
  | { kind: "create"; calendarId: string; sessionId: string; body: CalendarEventBody }
  | { kind: "patch"; calendarId: string; eventId: string; sessionId: string; body: CalendarEventBody }
  | { kind: "delete"; calendarId: string; eventId: string; sessionId: string };

export interface CalendarEventBody {
  summary: string;
  description: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties: { private: { theboxSessionId: string } };
}

export interface CalendarPushResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/** Paid sessions go on the classes calendar. Free sessions go on the community calendar. */
export function calendarIdForPrice(priceCents: number, ids: CalendarIds): string {
  return priceCents > 0 ? ids.classes : ids.community;
}

export function shouldPushToCalendar(session: { source: ClassSource }): boolean {
  return session.source === "zeffy" || session.source === "admin";
}

export function buildCalendarEvent(session: CalendarSession): CalendarEventBody {
  const register = session.zeffyUrl ? `Register: ${session.zeffyUrl}` : "";
  const seats = `Seats: ${session.capacity}`;
  const blurb = (session.description ?? "").trim();
  const description = [blurb, register, seats].filter(Boolean).join("\n");
  return {
    summary: session.title,
    description,
    location: session.location,
    start: { dateTime: session.startsAt, timeZone: TIME_ZONE },
    end: { dateTime: session.endsAt, timeZone: TIME_ZONE },
    extendedProperties: { private: { theboxSessionId: session.id } },
  };
}

export function planCalendarOps(
  sessions: CalendarSession[],
  ids: CalendarIds,
): CalendarOp[] {
  const ops: CalendarOp[] = [];
  for (const session of sessions) {
    if (!shouldPushToCalendar(session)) continue;
    const calendarId =
      session.googleCalendarId || calendarIdForPrice(session.priceCents, ids);
    if (session.cancelledAt) {
      if (session.googleEventId) {
        ops.push({
          kind: "delete",
          calendarId,
          eventId: session.googleEventId,
          sessionId: session.id,
        });
      }
      continue;
    }
    const body = buildCalendarEvent(session);
    if (session.googleEventId) {
      ops.push({
        kind: "patch",
        calendarId,
        eventId: session.googleEventId,
        sessionId: session.id,
        body,
      });
    } else {
      ops.push({
        kind: "create",
        calendarId: calendarIdForPrice(session.priceCents, ids),
        sessionId: session.id,
        body,
      });
    }
  }
  return ops;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** RS256 JWT for a Google service account. Uses WebCrypto so it runs on Workers. */
export async function signServiceAccountJwt(
  account: GoogleServiceAccount,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = textToBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
      ...(account.private_key_id ? { kid: account.private_key_id } : {}),
    }),
  );
  const payload = textToBase64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export function getCalendarIds(): CalendarIds | null {
  const classes = process.env.GOOGLE_CALENDAR_CLASSES_ID?.trim();
  const community = process.env.GOOGLE_CALENDAR_COMMUNITY_ID?.trim();
  if (!classes || !community) return null;
  return { classes, community };
}

export async function fetchCalendarAccessToken(
  account: GoogleServiceAccount,
): Promise<string> {
  const assertion = await signServiceAccountJwt(account);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error || `Google token exchange failed (${res.status})`);
  }
  return json.access_token;
}

export async function applyCalendarOps(
  ops: CalendarOp[],
  request: (op: CalendarOp) => Promise<{ id?: string } | void>,
): Promise<CalendarPushResult> {
  const result: CalendarPushResult = { created: 0, updated: 0, deleted: 0, errors: [] };
  for (const op of ops) {
    try {
      await request(op);
      if (op.kind === "create") result.created += 1;
      else if (op.kind === "patch") result.updated += 1;
      else result.deleted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Calendar request failed";
      console.error(JSON.stringify({ calendar: op.kind, sessionId: op.sessionId, error: message }));
      result.errors.push(`${op.sessionId}: ${message}`);
    }
  }
  return result;
}

export function calendarAccount(): GoogleServiceAccount | null {
  return parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}
