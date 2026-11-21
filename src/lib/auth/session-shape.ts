/**
 * What `/api/auth/session` sends to the browser.
 *
 * With sessions kept in the database, Auth.js hands the session callback the
 * whole Session row and the whole User row. Returned as they are, the browser
 * gets the session cookie's value (which the cookie itself keeps away from
 * scripts), staff notes about the member and their kiosk PIN hash. This picks
 * the few fields the app reads and drops the rest.
 */

type DbUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
};

export type ClientSession = {
  expires: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role?: string;
    status?: string;
  };
};

export function clientSession(
  session: {
    expires: string | Date;
    user?: { name?: string | null; email?: string | null } | null;
  },
  userId: string,
  dbUser: DbUser | null,
): ClientSession {
  const expires =
    session.expires instanceof Date ? session.expires.toISOString() : session.expires;
  if (!dbUser) {
    return {
      expires,
      user: {
        id: userId,
        name: session.user?.name ?? null,
        email: session.user?.email ?? "",
      },
    };
  }
  return {
    expires,
    user: {
      id: dbUser.id,
      name: dbUser.displayName || session.user?.name || null,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
    },
  };
}
