import type { EmailConfig } from "next-auth/providers/email";
import Resend from "next-auth/providers/resend";
import { normalizeSignInEmail } from "@/lib/sign-in-email";

type EmailEnv = {
  AUTH_RESEND_KEY?: string;
  AUTH_EMAIL_SERVER?: string;
  AUTH_EMAIL_FROM?: string;
};

/**
 * Magic-link email transport.
 * - Production (Cloudflare Workers): Resend over HTTPS. Set AUTH_RESEND_KEY.
 * - Local dev: SMTP (Mailpit at 127.0.0.1:1025 by default).
 * Both are registered under the id "email" so the login page can call
 * signIn("email") regardless of which transport is active.
 * Both only ever get one bare address to write to (normalizeSignInEmail).
 */
export function emailProvider(env: EmailEnv): EmailConfig {
  const from = env.AUTH_EMAIL_FROM ?? "The Box <thebox@discoverburien.org>";
  if (env.AUTH_RESEND_KEY) {
    return Resend({
      id: "email",
      apiKey: env.AUTH_RESEND_KEY,
      from,
      normalizeIdentifier: normalizeSignInEmail,
    });
  }
  return localSmtp(env.AUTH_EMAIL_SERVER ?? "smtp://127.0.0.1:1025", from);
}

/**
 * SMTP for local development only. Workers have no use for an SMTP client, so
 * nodemailer is a dev dependency and is loaded inside a branch the production
 * build drops. Do not import it at the top of a file: that would put it back
 * in the Worker bundle.
 */
function localSmtp(server: string, from: string): EmailConfig {
  return {
    id: "email",
    type: "email",
    name: "Email",
    from,
    maxAge: 24 * 60 * 60,
    normalizeIdentifier: normalizeSignInEmail,
    async sendVerificationRequest({ identifier, url }) {
      if (process.env.NODE_ENV !== "production") {
        const { createTransport } = await import("nodemailer");
        const { host } = new URL(url);
        const result = await createTransport(server).sendMail({
          to: identifier,
          from,
          subject: `Sign in to ${host}`,
          text: `Sign in to ${host}\n${url}\n\n`,
          html: `<p>Sign in to <strong>${host}</strong></p><p><a href="${url}">Sign in</a></p>`,
        });
        // Either list can be missing, depending on how far the send got.
        const failed = [...(result.rejected ?? []), ...(result.pending ?? [])];
        if (failed.length) {
          throw new Error(`Email (${failed.join(", ")}) could not be sent`);
        }
        return;
      }
      // A deployment that lost its key should say so, not time out on SMTP.
      throw new Error("Sign-in email is not configured: set AUTH_RESEND_KEY.");
    },
  };
}
