/**
 * Env helpers for the Google Drive CMS. Safe to call when nothing is configured.
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   full service-account key JSON (single line),
 *                                 or a path to the downloaded .json file
 *   GOOGLE_DRIVE_FOLDER_ID        "The Box Website" shared folder id
 *   GOOGLE_CONTENT_INDEX_SHEET_ID optional Content Index sheet id (slug | title | category | doc | published | version)
 *   GOOGLE_SCHEDULE_SHEET_ID      optional; reserved for live Sheet → classes sync later
 */
import { existsSync, readFileSync } from "node:fs";

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  /** Optional; used for the JWT `kid` header when present. */
  private_key_id?: string;
}

export interface GoogleCmsConfig {
  serviceAccount: GoogleServiceAccount;
  folderId: string;
  contentIndexSheetId: string | null;
  scheduleSheetId: string | null;
}

export const GOOGLE_ENV_KEYS = [
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_DRIVE_FOLDER_ID",
  "GOOGLE_CONTENT_INDEX_SHEET_ID",
  "GOOGLE_SCHEDULE_SHEET_ID",
] as const;

/** Parse a service-account key from inline JSON or a file path. Returns null if unset/invalid. */
export function parseServiceAccount(
  raw: string | undefined,
): GoogleServiceAccount | null {
  const value = raw?.trim();
  if (!value) return null;

  let text = value;
  if (!value.startsWith("{")) {
    if (!existsSync(value)) return null;
    text = readFileSync(value, "utf8");
  }

  try {
    const parsed = JSON.parse(text) as Partial<GoogleServiceAccount>;
    if (
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }
    return {
      client_email: parsed.client_email,
      // Vercel/CI env editors often flatten newlines to the literal "\n".
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
      private_key_id: parsed.private_key_id,
    };
  } catch {
    return null;
  }
}

export function getGoogleServiceAccount(): GoogleServiceAccount | null {
  return parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

export function getGoogleDriveFolderId(): string | null {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  return id || null;
}

export function getGoogleCmsConfig(): GoogleCmsConfig | null {
  const serviceAccount = getGoogleServiceAccount();
  const folderId = getGoogleDriveFolderId();
  if (!serviceAccount || !folderId) return null;
  return {
    serviceAccount,
    folderId,
    contentIndexSheetId:
      process.env.GOOGLE_CONTENT_INDEX_SHEET_ID?.trim() || null,
    scheduleSheetId: process.env.GOOGLE_SCHEDULE_SHEET_ID?.trim() || null,
  };
}

export function isGoogleConfigured(): boolean {
  return getGoogleCmsConfig() !== null;
}

/** System actor recorded on content synced from Drive. */
export const GOOGLE_SYSTEM_ACTOR_ID = "system:google-drive";
