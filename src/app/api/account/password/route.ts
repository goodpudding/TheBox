import { NextResponse, connection, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { passwordPolicyError } from "@/lib/auth/password";
import { savePassword } from "@/lib/auth/password-sign-in";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/** The names Auth.js gives its session cookie, over https and over http. */
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * The signed-in member. Only a real session counts here: the dev toolbar's
 * switch-user header can stand in for a member elsewhere, but must not be
 * able to give one a password.
 */
async function signedInMember(): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const row = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, email: true },
  });
  return row ?? null;
}

/**
 * Sign the member out everywhere but here. Whoever else was signed in as
 * them, on a shop PC they walked away from or anywhere else, is not any
 * more once the password changes.
 */
async function endOtherSessions(request: NextRequest, userId: string): Promise<void> {
  const here = SESSION_COOKIES.map((name) => request.cookies.get(name)?.value).filter(
    (value): value is string => Boolean(value),
  );
  // Not knowing which session is this one, ending them all would sign the
  // member out in the middle of saving.
  if (here.length === 0) return;
  await prisma.session.deleteMany({
    where: { userId, sessionToken: { notIn: here } },
  });
}

/** Whether the member has chosen a password. Never the password or its hash. */
export async function GET() {
  await connection();
  try {
    const member = await signedInMember();
    if (!member) return json({ error: "Sign in required" }, 401);
    const row = await prisma.userPassword.findUnique({
      where: { userId: member.id },
      select: { setAt: true },
    });
    return json({ passwordSet: Boolean(row), setAt: row?.setAt.toISOString() ?? null });
  } catch (err) {
    console.error(JSON.stringify({ route: "account/password", error: String(err) }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

/**
 * Choose or change the password. Being signed in is enough, with no "current
 * password" asked for: the emailed link is how a member gets in when they
 * have forgotten it, and this is where they then replace it.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const member = await signedInMember();
    if (!member) return json({ error: "Sign in required" }, 401);
    const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const problem = passwordPolicyError(body?.password, member.email);
    if (problem) return json({ error: problem }, 400);
    await savePassword(member.id, body?.password as string);
    await endOtherSessions(request, member.id);
    console.info(JSON.stringify({ route: "account/password", set: true }));
    return json({ ok: true, passwordSet: true });
  } catch (err) {
    console.error(JSON.stringify({ route: "account/password", error: String(err) }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

/** Go back to signing in by emailed link only. */
export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const member = await signedInMember();
    if (!member) return json({ error: "Sign in required" }, 401);
    await prisma.userPassword.deleteMany({ where: { userId: member.id } });
    await endOtherSessions(request, member.id);
    console.info(JSON.stringify({ route: "account/password", removed: true }));
    return json({ ok: true, passwordSet: false });
  } catch (err) {
    console.error(JSON.stringify({ route: "account/password", error: String(err) }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
