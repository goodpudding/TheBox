/**
 * Service-account OAuth2 for Google APIs with no SDK dependency.
 *
 * Signs a short-lived RS256 JWT with the service-account private key and
 * exchanges it for an access token at the Google token endpoint.
 * https://developers.google.com/identity/protocols/oauth2/service-account
 */
import { createSign } from "node:crypto";
import type { GoogleServiceAccount } from "./config";

export const DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_TTL_SECONDS = 3600;
/** Refresh a little early so an in-flight sync never trips over expiry. */
const REFRESH_SKEW_SECONDS = 120;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildServiceAccountJwt(
  account: GoogleServiceAccount,
  scopes: string[],
  now: number = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: "RS256", typ: "JWT", kid: account.private_key_id };
  const claims = {
    iss: account.client_email,
    scope: scopes.join(" "),
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(account.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

export interface AccessToken {
  token: string;
  /** Unix seconds. */
  expiresAt: number;
}

export async function fetchAccessToken(
  account: GoogleServiceAccount,
  scopes: string[] = [DRIVE_READONLY_SCOPE],
  fetchImpl: typeof fetch = fetch,
): Promise<AccessToken> {
  const assertion = buildServiceAccountJwt(account, scopes);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google token exchange failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const ttl = json.expires_in ?? TOKEN_TTL_SECONDS;
  return {
    token: json.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + ttl,
  };
}

/** Caches one token per service account + scope set and refreshes before expiry. */
export class ServiceAccountTokenSource {
  private cached: AccessToken | null = null;

  constructor(
    private readonly account: GoogleServiceAccount,
    private readonly scopes: string[] = [DRIVE_READONLY_SCOPE],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (!this.cached || this.cached.expiresAt - REFRESH_SKEW_SECONDS <= now) {
      this.cached = await fetchAccessToken(
        this.account,
        this.scopes,
        this.fetchImpl,
      );
    }
    return this.cached.token;
  }
}
