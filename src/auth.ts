import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";
import { allowRequest, emailLimitKey } from "@/lib/rate-limit";
import { SIGN_IN_LIMITED_PATH, normalizeSignInEmail } from "@/lib/sign-in-email";

const from =
  process.env.AUTH_EMAIL_FROM ?? "The Box <thebox@discoverburien.org>";

/**
 * Magic-link email transport.
 * - Production (Cloudflare Workers): Resend over HTTPS. Set AUTH_RESEND_KEY.
 * - Local dev: SMTP via Nodemailer (Mailpit at 127.0.0.1:1025 by default).
 * Workers have no raw TCP sockets, so SMTP cannot run there.
 * Both are registered under the id "email" so the login page can call
 * signIn("email") regardless of which transport is active.
 * Both only ever get one bare address to write to (normalizeSignInEmail).
 */
function emailProvider(): Provider {
  const shared = { id: "email", from, normalizeIdentifier: normalizeSignInEmail };
  if (process.env.AUTH_RESEND_KEY) {
    return Resend({ ...shared, apiKey: process.env.AUTH_RESEND_KEY });
  }
  return Nodemailer({
    ...shared,
    server: process.env.AUTH_EMAIL_SERVER ?? "smtp://127.0.0.1:1025",
  });
}

/**
 * Auth.js magic-link config.
 * Mock UI mode still uses the Dev · Switch user toolbar.
 * Magic links match existing User rows by email (fixture emails work after seed).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [emailProvider()],
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
