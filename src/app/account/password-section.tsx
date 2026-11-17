"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Kept in step with MIN_PASSWORD_LENGTH; the server has the final say. */
const MIN_LENGTH = 10;

/**
 * Choose, change or remove the website password. Live site only: the
 * fixture UI has no sign-in to use one with.
 */
export function PasswordSection({ email }: { email: string }) {
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const res = await fetch("/api/account/password", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { passwordSet?: boolean };
        if (current) setPasswordSet(Boolean(body.passwordSet));
      } catch {
        // The form below still works; it just cannot say whether one is set.
      }
    })();
    return () => {
      current = false;
    };
  }, []);

  async function send(method: "POST" | "DELETE", password?: string) {
    const res = await fetch("/api/account/password", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({ password }) : undefined,
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not save your password");
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("newPassword") ?? "");
    setError(null);
    setMessage(null);
    if (password !== String(data.get("confirmPassword") ?? "")) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    try {
      await send("POST", password);
      setPasswordSet(true);
      setMessage("Password saved. Anywhere else you were signed in has been signed out.");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your password");
    } finally {
      setPending(false);
    }
  }

  async function onRemove() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await send("DELETE");
      setPasswordSet(false);
      setMessage("Password removed. Sign in with an email link from now on.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove your password");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-16 max-w-xl">
      <p className="eyebrow">Password</p>
      <p className="mt-3 text-secondary leading-relaxed">
        Optional. With a password you can sign in to this website without
        waiting for an email. The email link keeps working either way, and is
        how you get back in if you forget it. At least {MIN_LENGTH} characters.
      </p>
      {passwordSet ? (
        <p className="mt-4 font-display font-semibold text-brown">
          Password is set · Change password
        </p>
      ) : null}
      <form onSubmit={onSave} className="mt-4 space-y-4">
        {/* Lets a password manager file the new password under this email. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="space-y-2">
          <Label htmlFor="new-password">{passwordSet ? "New password" : "Password"}</Label>
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
          />
        </div>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-primary-text">{message}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : passwordSet ? "Change password" : "Save password"}
          </Button>
          {passwordSet ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={onRemove}>
              Remove password
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
