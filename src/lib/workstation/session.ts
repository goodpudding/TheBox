import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const WORKSTATION_COOKIE = "thebox_workstation";

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export async function readWorkstationToken(
  request?: Request,
): Promise<string | null> {
  const header = request?.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const jar = await cookies();
  return jar.get(WORKSTATION_COOKIE)?.value ?? null;
}

export async function setWorkstationCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(WORKSTATION_COOKIE, token, cookieOptions());
}

export async function clearWorkstationCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(WORKSTATION_COOKIE);
}
