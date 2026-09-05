import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "@/lib/db";

/**
 * Auth.js magic-link config.
 * Mock UI mode still uses the Dev · Switch user toolbar.
 * Magic links match existing User rows by email (fixture emails work after seed).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: process.env.AUTH_EMAIL_SERVER ?? "smtp://127.0.0.1:1025",
      from:
        process.env.AUTH_EMAIL_FROM ??
        "The Box <thebox@discoverburien.org>",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
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
