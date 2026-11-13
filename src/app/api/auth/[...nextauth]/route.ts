import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import {
  RATE_LIMIT_MESSAGE,
  allowRequest,
  clientIp,
  ipLimitKey,
  rateLimitHeaders,
  type RateLimitName,
} from "@/lib/rate-limit";
import { SIGN_IN_LIMITED_PATH } from "@/lib/sign-in-email";

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
 * True when Auth.js answered that the mailbox is over its limit. That count
 * is kept in src/auth.ts, where Auth.js has already settled which address
 * the email goes to; its answer is a redirect to the login page.
 */
function mailboxLimited(response: Response): boolean {
  const location = response.headers.get("location");
  if (!location) return false;
  try {
    const target = new URL(location, "http://localhost");
    return `${target.pathname}${target.search}` === SIGN_IN_LIMITED_PATH;
  } catch {
    return false;
  }
}

function refuse(request: Request, name: RateLimitName) {
  console.warn(JSON.stringify({ auth: "signin-email", limited: name }));
  // next-auth's signIn() reads `url` and gives its ?error= code to the login
  // page, which has the words for it.
  const url = new URL(SIGN_IN_LIMITED_PATH, request.url);
  return NextResponse.json(
    { error: RATE_LIMIT_MESSAGE, url: url.toString() },
    { status: 429, headers: rateLimitHeaders(name) },
  );
}

export async function POST(request: NextRequest) {
  if (!sendsSignInEmail(request)) return handlers.POST(request);
  if (!(await allowRequest("signInEmailIp", ipLimitKey(clientIp(request))))) {
    return refuse(request, "signInEmailIp");
  }
  // Per mailbox as well, so one inbox cannot be flooded from many places.
  const response = await handlers.POST(request);
  return mailboxLimited(response) ? refuse(request, "signInEmailAddress") : response;
}
