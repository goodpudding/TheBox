import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import {
  RATE_LIMIT_MESSAGE,
  allowRequest,
  clientIp,
  emailLimitKey,
  ipLimitKey,
  rateLimitHeaders,
  type RateLimitName,
} from "@/lib/rate-limit";

export const GET = handlers.GET;

/**
 * A POST to signin/<provider> sends a magic-link email to whatever address is
 * in the body. Auth.js ignores empty path segments, so match the same way.
 */
function sendsSignInEmail(request: Request): boolean {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return parts.length >= 2 && parts[parts.length - 2] === "signin";
}

/**
 * The address the link would go to. Read from a copy: Auth.js needs the body.
 * When a form names `email` twice Auth.js keeps the last one, so this does too.
 */
async function requestedEmail(request: Request): Promise<string | null> {
  try {
    const copy = request.clone();
    const type = request.headers.get("content-type") ?? "";
    const email = type.includes("application/json")
      ? ((await copy.json()) as { email?: unknown } | null)?.email
      : new URLSearchParams(await copy.text()).getAll("email").at(-1);
    return typeof email === "string" && email.trim() ? email : null;
  } catch {
    return null;
  }
}

function refuse(request: Request, name: RateLimitName) {
  console.warn(JSON.stringify({ auth: "signin-email", limited: name }));
  // next-auth's signIn() reads `url` and gives its ?error= code to the login
  // page, which has the words for it.
  const url = new URL("/login?error=RateLimit", request.url);
  return NextResponse.json(
    { error: RATE_LIMIT_MESSAGE, url: url.toString() },
    { status: 429, headers: rateLimitHeaders(name) },
  );
}

export async function POST(request: NextRequest) {
  if (sendsSignInEmail(request)) {
    if (!(await allowRequest("signInEmailIp", ipLimitKey(clientIp(request))))) {
      return refuse(request, "signInEmailIp");
    }
    // Per mailbox as well, so one inbox cannot be flooded from many places.
    const email = await requestedEmail(request);
    if (email && !(await allowRequest("signInEmailAddress", emailLimitKey(email)))) {
      return refuse(request, "signInEmailAddress");
    }
  }
  return handlers.POST(request);
}
