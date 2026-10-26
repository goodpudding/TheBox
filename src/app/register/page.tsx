"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentPage, OrgSettings, User } from "@/lib/data";

export default function RegisterPage() {
  const { provider, bump } = useData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [waiver, setWaiver] = useState<ContentPage | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{
    user: User;
    created: boolean;
    waiverVersion: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [nextWaiver, nextSettings] = await Promise.all([
        provider.getWaiver(),
        provider.getSettings(),
      ]);
      if (!cancelled) {
        setWaiver(nextWaiver);
        setSettings(nextSettings);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !waiver) return;
    if (el.scrollHeight <= el.clientHeight + 4) setScrolledToEnd(true);
  }, [waiver]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
      setScrolledToEnd(true);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRegistered(null);

    if (!scrolledToEnd) {
      setError("Scroll through the full waiver before signing.");
      return;
    }
    if (!agreed) {
      setError("Check the box to confirm you agree to the waiver.");
      return;
    }

    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      const result = await provider.registerWithWaiver({
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        emergencyContactName: String(form.get("emergencyContactName") ?? ""),
        emergencyContactPhone: String(form.get("emergencyContactPhone") ?? ""),
        emergencyContactRelation: String(
          form.get("emergencyContactRelation") ?? "",
        ),
        newsletterOptIn: form.get("newsletterOptIn") === "on",
        fullNameTyped: String(form.get("fullNameTyped") ?? ""),
        agreed: true,
        ip: "127.0.0.1",
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      bump();
      setRegistered({
        user: result.user,
        created: result.created,
        waiverVersion: result.waiverSignature.version,
      });
      e.currentTarget.reset();
      setAgreed(false);
      setScrolledToEnd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Visitor registration"
        title="Register and sign the waiver"
        description="Scan this page when you arrive, create your portal record, sign the current waiver, and choose whether you want The Box newsletter."
      />

      {registered ? (
        <div className="mt-8 max-w-2xl rounded-3xl border border-primary/30 bg-primary/10 p-6">
          <p className="font-display text-xl font-semibold text-brown">
            {registered.created ? "Account created." : "Account updated."}
          </p>
          <p className="mt-2 text-secondary leading-relaxed">
            {registered.user.displayName} is registered with waiver version{" "}
            {registered.waiverVersion} on file. Newsletter preference:{" "}
            {registered.user.newsletterOptIn ? "yes" : "no"}.
          </p>
          <p className="mt-3 text-sm text-secondary">
            Staff can find this record under Admin → Members and activate shop
            access after payment or approval.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={() => setRegistered(null)}>
              Register another visitor
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Sign in later</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {!registered ? (
        <>
          <section className="mt-8 max-w-3xl">
            <div
              data-testid="registration-waiver"
              ref={scrollRef}
              onScroll={onScroll}
              className="max-h-[min(50vh,26rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              {waiver ? (
                <>
                  <p className="font-display text-xs uppercase tracking-wider text-secondary">
                    Waiver version {waiver.version}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-brown">
                    {waiver.title}
                  </h2>
                  <div
                    className="prose-cms mt-4"
                    dangerouslySetInnerHTML={{ __html: waiver.html }}
                  />
                </>
              ) : (
                <p className="text-secondary">Loading waiver...</p>
              )}
            </div>
            <p className="mt-3 font-display text-sm text-secondary">
              {scrolledToEnd
                ? "Full waiver reviewed - you can sign below."
                : "Keep scrolling to unlock the signature fields."}
            </p>
          </section>

          <form onSubmit={onSubmit} className="mt-8 max-w-2xl space-y-6">
            <section className="space-y-5">
              <p className="eyebrow">Your information</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="firstName" label="First name" required />
                <Field id="lastName" label="Last name" required />
              </div>
              <Field id="email" label="Email" type="email" required />
              <Field id="phone" label="Phone" type="tel" required />
            </section>

            <section className="space-y-5">
              <p className="eyebrow">Emergency contact</p>
              <Field id="emergencyContactName" label="Emergency contact name" required />
              <Field
                id="emergencyContactPhone"
                label="Emergency contact phone"
                type="tel"
                required
              />
              <Field
                id="emergencyContactRelation"
                label="Relationship"
                placeholder="Parent, partner, friend..."
              />
            </section>

            <section className="space-y-5">
              <p className="eyebrow">Signature & updates</p>
              <Field
                id="fullNameTyped"
                label="Type your full legal name"
                required
                disabled={!scrolledToEnd}
              />
              <label className="flex items-start gap-3 text-sm text-charcoal">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border accent-[var(--color-button)]"
                  checked={agreed}
                  disabled={!scrolledToEnd}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>
                  I have read this waiver (version {waiver?.version ?? "..."})
                  and agree to its terms. My typed name is my electronic
                  signature.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-charcoal">
                <input
                  type="checkbox"
                  name="newsletterOptIn"
                  className="mt-1 h-4 w-4 rounded border-border accent-[var(--color-button)]"
                />
                <span>
                  Send me The Box newsletter with open hours, classes, and
                  member updates. I can opt out later.
                </span>
              </label>
            </section>

            {error ? (
              <p className="text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending || !scrolledToEnd}>
                {pending ? "Registering..." : "Create account & sign waiver"}
              </Button>
              <Button asChild variant="secondary">
                <a
                  href={settings?.paymentUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Membership checkout
                </a>
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </PageShell>
  );
}

function Field({
  id,
  label,
  type = "text",
  required = false,
  disabled = false,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
