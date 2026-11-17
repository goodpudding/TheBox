import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { emailProvider } from "@/lib/auth/email-provider";
import { checkPasswordSignIn } from "@/lib/auth/password-sign-in";
import { prisma } from "@/lib/db";
import { allowRequest, emailLimitKey } from "@/lib/rate-limit";
import { PASSWORD_PROVIDER_ID, SIGN_IN_LIMITED_PATH } from "@/lib/sign-in-email";

/**
 * Auth.js config: an emailed link, or the email and a password.
 * Mock UI mode still uses the Dev · Switch user toolbar.
 * Both ways match existing User rows by email (fixture emails work after
 * seed). A password exists only once a member chooses one on their account
 * page (src/lib/auth/password-sign-in.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Sessions are rows in the database, for both ways of signing in.
  session: { strategy: "database" },
  providers: [
    emailProvider({
      AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
      AUTH_EMAIL_SERVER: process.env.AUTH_EMAIL_SERVER,
      AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    }),
    Credentials({
      id: PASSWORD_PROVIDER_ID,
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) =>
        checkPasswordSignIn(credentials?.email, credentials?.password),
    }),
  ],
  jwt: {
    /**
     * Auth.js gives a password sign-in a signed token for a cookie instead
     * of a session row, and then cannot find that token in the database, so
     * the member would be signed out again at once. With database sessions
     * this is the only place Auth.js asks for a token, so make the row here
     * and hand back its key: the cookie then holds the same kind of value an
     * emailed link leaves, and signing out deletes the row as usual.
     */
    async encode({ token, maxAge }) {
      if (!token?.sub) throw new Error("Password sign-in has no member to start a session for.");
      const sessionToken = crypto.randomUUID();
      await prisma.session.create({
        data: {
          sessionToken,
          userId: token.sub,
          expires: new Date(Date.now() + (maxAge ?? 30 * 24 * 60 * 60) * 1000),
        },
      });
      return sessionToken;
    },
  },
  logger: {
    error(error) {
      // A wrong password is not a fault. checkPasswordSignIn has already
      // written one line for it; Auth.js would add a stack trace each time.
      if (error instanceof CredentialsSignin) return;
      console.error("[auth][error]", error);
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  callbacks: {
    /**
     * Auth.js asks this right before it sends a sign-in email, after it has
     * checked the CSRF token and the address. Counting here means the count
     * is for the address the email really goes to, and a request that sends
     * nothing cannot use up someone else's share. A link being opened comes
     * through here too (no `email`) and is never limited.
     */
    async signIn({ account, email }) {
      if (!email?.verificationRequest || !account) return true;
      const mailbox = emailLimitKey(account.providerAccountId);
      return (await allowRequest("signInEmailAddress", mailbox)) || SIGN_IN_LIMITED_PATH;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          session.user.name = dbUser.displayName || session.user.name;
          session.user.email = dbUser.email;
          session.user.role = dbUser.role;
          session.user.status = dbUser.status;
        }
      }
      return session;
    },
  },
  trustHost: true,
});
