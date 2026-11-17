"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { PageHero, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_PROVIDER_ID } from "@/lib/sign-in-email";

/**
 * Auth.js sends `?error=` here (pages.error); NoAccount comes from providers.tsx.
 * RateLimit comes from the sign-in route when too many links or passwords
 * were tried. CredentialsSignin is every way a password sign-in can fail.
 */
const ERROR_MESSAGES: Record<string, string> = {
  Verification: "That link expired, request a new one.",
  NoAccount: "We couldn't find an account for this email.",
  RateLimit: "Too many requests. Wait a minute and try again.",
  CredentialsSignin:
    "That email and password didn't match, or there were too many tries. You can always sign in with an email link.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"password" | "link" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode
      ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Try again, or request a new link.")
      : null,
  );

  function callbackUrl(): string {
    const raw = searchParams.get("callbackUrl");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Enter your password, or use the email link below.");
      return;
    }
    setPending("password");
    setError(null);
    const next = callbackUrl();
    let problem: string;
    try {
      const res = await signIn(PASSWORD_PROVIDER_ID, {
        email,
        password,
        redirect: false,
        callbackUrl: next,
      });
      if (res?.ok && !res.error) {
        // A full page load, so every part of the site starts from the new
        // session. The buttons stay off until it arrives.
        window.location.assign(next);
        return;
      }
      problem =
        ERROR_MESSAGES[res?.error ?? ""] ?? "Sign-in failed. Try again, or use the email link.";
    } catch (err) {
      problem = err instanceof Error ? err.message : "Could not sign in";
    }
    setPassword("");
    setError(problem);
    setPending(null);
  }

  async function onSendLink() {
    // The link only needs the email, whatever is in the password box.
    if (!emailInput.current?.reportValidity()) return;
    setPending("link");
    setError(null);
    try {
      const res = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: callbackUrl(),
      });
      if (res?.error) {
        setError(ERROR_MESSAGES[res.error] ?? res.error);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send link");
    } finally {
      setPending(null);
    }
  }

  return (
    <PageShell className="max-w-lg">
      <PageHero
        eyebrow="Sign in"
        title="Welcome back"
        description="Enter the email on your membership, then your password. Or skip the password and we’ll email you a one-time sign-in link."
      />

      {sent ? (
        <p className="mt-8 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-brown">
          Check your email for a sign-in link
          {process.env.NODE_ENV === "development"
            ? " (Mailpit at http://localhost:8025 when using Docker)"
            : ""}
          .
        </p>
      ) : (
        <form onSubmit={onPasswordSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              ref={emailInput}
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-accent" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending !== null}>
              {pending === "password" ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending !== null}
              onClick={onSendLink}
            >
              {pending === "link" ? "Sending…" : "Email me a link"}
            </Button>
          </div>
          <p className="text-sm text-secondary leading-relaxed">
            No password yet, or forgot it? Use the email link. Once you’re in,
            choose a password on your Account page.
          </p>
        </form>
      )}
    </PageShell>
  );
}
