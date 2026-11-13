import type { Session } from "next-auth";

/**
 * What Auth.js passes the session callback with database sessions: the Session
 * row (`id`, `sessionToken`, `userId`, `expires`) with the whole User row
 * attached as `user`. Only the fields read here are declared.
 */
export type AdapterSessionInput = {
  expires: Date | string;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
};

/** The member columns the app reads from the session. */
export type SessionMember = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
};

/**
 * Build the session that `/api/auth/session` sends to the browser.
 *
 * The result is a new object holding only what the app uses. Returning the
 * object Auth.js passes in would publish the session token, which the httpOnly
 * cookie exists to keep away from page scripts, and every User column
 * (PIN hash, phone, emergency contact, staff notes).
 */
export function toClientSession(
  session: AdapterSessionInput,
  dbUser: SessionMember | null,
): Session {
  const expires =
    session.expires instanceof Date
      ? session.expires.toISOString()
      : session.expires;

  if (!dbUser) {
    return {
      user: {
        id: session.user?.id ?? "",
        ...(session.user?.email ? { email: session.user.email } : {}),
      },
      expires,
    };
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.displayName || session.user?.name || null,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
    },
    expires,
  };
}
