"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { PageHero, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Auth.js sends `?error=` here (pages.error); NoAccount comes from providers.tsx.
 * RateLimit comes from the sign-in route when too many links were asked for.
 */
const ERROR_MESSAGES: Record<string, string> = {
  Verification: "That link expired, request a new one.",
  NoAccount: "We couldn't find an account for this email.",
  RateLimit: "Too many requests. Wait a minute and try again.",
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
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode
      ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Request a new link.")
      : null,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const callbackUrl = (() => {
        const raw = searchParams.get("callbackUrl");
        if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
        return raw;
      })();
      const res = await signIn("email", {
        email,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        setError(ERROR_MESSAGES[res.error] ?? res.error);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send link");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell className="max-w-lg">
      <PageHero
        eyebrow="Sign in"
        title="Magic link"
        description="Enter the email on your membership. We’ll send a one-time sign-in link."
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
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error ? (
            <p className="text-sm text-accent" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Email me a link"}
          </Button>
        </form>
      )}
    </PageShell>
  );
}
