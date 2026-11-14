import { NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import { syncZeffyPurchasesForEmail } from "@/lib/zeffy/sync-purchases";
import {
  RATE_LIMIT_MESSAGE,
  allowRequest,
  rateLimitHeaders,
  userLimitKey,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Apply this signed-in member's recent Zeffy purchases onto their portal account. */
export async function POST() {
  await connection();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  // Each run pulls 90 days of Zeffy payments. The account page asks once per
  // visit and carries on without the answer, so a refusal costs it nothing.
  const key = userLimitKey(session.user?.id || email);
  if (!(await allowRequest("syncMembership", key))) {
    console.warn(JSON.stringify({ route: "account/sync-membership", limited: "syncMembership" }));
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      { status: 429, headers: rateLimitHeaders("syncMembership") },
    );
  }
  try {
    const result = await syncZeffyPurchasesForEmail(email);
    return NextResponse.json(result);
  } catch (err) {
    // The reason stays in the Worker log. It can be database error text.
    console.error(JSON.stringify({ route: "account/sync-membership", error: String(err) }));
    return NextResponse.json(
      { error: "Could not check your Zeffy purchases. Try again later." },
      { status: 500 },
    );
  }
}
