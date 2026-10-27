import { NextResponse, connection } from "next/server";
import { auth } from "@/auth";
import { syncZeffyPurchasesForEmail } from "@/lib/zeffy/sync-purchases";

export const runtime = "nodejs";

/** Apply this signed-in member's recent Zeffy purchases onto their portal account. */
export async function POST() {
  await connection();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  try {
    const result = await syncZeffyPurchasesForEmail(email);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sync Zeffy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
