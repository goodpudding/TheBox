"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { PageHero, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await signIn("nodemailer", {
        email,
        redirect: false,
        callbackUrl: "/",
      });
      if (res?.error) {
        setError(res.error);
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
        description="Enter the email on your membership. We’ll send a one-time sign-in link. In local mock mode you can also use the Dev · Switch user bar."
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
