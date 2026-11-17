import { prisma } from "@/lib/db";
import { normalizeSignInEmail } from "@/lib/sign-in-email";
import {
  MAX_PASSWORD_LENGTH,
  hashPassword,
  passwordHashIsCurrent,
  spendPasswordCheck,
  verifyPassword,
} from "./password";

/**
 * Email + password sign-in for the website, next to the emailed link.
 *
 * A member has a password only after choosing one on their account page, and
 * the emailed link always works, so it is also how a forgotten password is
 * replaced. That is why a lock here costs a member nothing but a trip to
 * their inbox, and why the limit can be strict.
 */

/** Wrong passwords allowed for one account in one window. */
export const MAX_WRONG_PASSWORDS = 5;
export const PASSWORD_WINDOW_MS = 15 * 60 * 1000;

export type PasswordSignInUser = { id: string; email: string; name: string };

/**
 * Count this attempt before the password is looked at. The database does the
 * adding and refuses past the limit in the same statement, so requests sent
 * together cannot each see "not locked" and each get a guess.
 * A correct password gives its attempt back (releaseAttempt); it does not
 * clear the others, or someone guessing would get a fresh five every time
 * the member signed in.
 */
async function claimAttempt(userId: string, now: number): Promise<boolean> {
  await prisma.userPassword.updateMany({
    where: {
      userId,
      OR: [
        { windowStartedAt: null },
        { windowStartedAt: { lt: new Date(now - PASSWORD_WINDOW_MS) } },
      ],
    },
    data: { failedCount: 0, windowStartedAt: new Date(now) },
  });
  const claimed = await prisma.userPassword.updateMany({
    where: { userId, failedCount: { lt: MAX_WRONG_PASSWORDS } },
    data: { failedCount: { increment: 1 } },
  });
  return claimed.count === 1;
}

async function releaseAttempt(userId: string): Promise<void> {
  await prisma.userPassword.updateMany({
    where: { userId, failedCount: { gt: 0 } },
    data: { failedCount: { decrement: 1 } },
  });
}

function refused(reason: "input" | "unknown" | "locked" | "wrong"): null {
  // No address and no password in the log: the reason alone is enough to see
  // guessing in the Worker logs.
  if (reason !== "input") console.warn(JSON.stringify({ auth: "password", refused: reason }));
  return null;
}

/**
 * The member this email and password belong to, or null. Null covers every
 * way of failing (no such member, no password chosen, wrong password, too
 * many wrong ones) and each takes about as long, so the answer does not say
 * whether an address has an account.
 */
export async function checkPasswordSignIn(
  emailInput: unknown,
  passwordInput: unknown,
  now = Date.now(),
): Promise<PasswordSignInUser | null> {
  if (typeof emailInput !== "string" || typeof passwordInput !== "string") {
    return refused("input");
  }
  if (!passwordInput || passwordInput.length > 4 * MAX_PASSWORD_LENGTH) {
    return refused("input");
  }
  let email: string;
  try {
    email = normalizeSignInEmail(emailInput);
  } catch {
    return refused("input");
  }

  const member = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      displayName: true,
      password: { select: { hash: true } },
    },
  });
  if (!member?.password) {
    await spendPasswordCheck(passwordInput);
    return refused("unknown");
  }
  if (!(await claimAttempt(member.id, now))) {
    await spendPasswordCheck(passwordInput);
    return refused("locked");
  }
  if (!(await verifyPassword(passwordInput, member.password.hash))) {
    return refused("wrong");
  }

  await releaseAttempt(member.id);
  if (!passwordHashIsCurrent(member.password.hash)) {
    // Only this exact hash is replaced, so a password changed a moment ago
    // elsewhere is not put back.
    await prisma.userPassword.updateMany({
      where: { userId: member.id, hash: member.password.hash },
      data: { hash: await hashPassword(passwordInput) },
    });
  }
  return { id: member.id, email: member.email, name: member.displayName };
}

/**
 * Save a new password for a signed-in member and start the wrong-password
 * count again, so a member locked out by someone guessing is let back in.
 * The caller has already checked the password against the rules.
 */
export async function savePassword(userId: string, password: string, now = Date.now()) {
  const data = {
    hash: await hashPassword(password),
    failedCount: 0,
    windowStartedAt: null,
    setAt: new Date(now),
  };
  await prisma.userPassword.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
