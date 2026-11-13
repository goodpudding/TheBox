import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { emailProvider } from "@/lib/auth/email-provider";
import { prisma } from "@/lib/db";

/**
 * Auth.js magic-link config.
 * Mock UI mode still uses the Dev · Switch user toolbar.
 * Magic links match existing User rows by email (fixture emails work after seed).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    emailProvider({
      AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
      AUTH_EMAIL_SERVER: process.env.AUTH_EMAIL_SERVER,
      AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  callbacks: {
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
