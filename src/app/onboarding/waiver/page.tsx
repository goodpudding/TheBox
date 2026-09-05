"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentPage } from "@/lib/data";

export default function OnboardingWaiverPage() {
  return (
    <MemberGate requireOnboardingComplete={false}>
      <WaiverForm />
    </MemberGate>
  );
}

function WaiverForm() {
  const { provider, currentUser, bump } = useData();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [waiver, setWaiver] = useState<ContentPage | null>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void provider.getWaiver().then(setWaiver);
  }, [provider]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !waiver) return;
    // Short content may already fit
    if (el.scrollHeight <= el.clientHeight + 4) setScrolledToEnd(true);
  }, [waiver]);

  if (!currentUser) return null;

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
      setScrolledToEnd(true);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);
    if (!scrolledToEnd) {
      setError("Scroll through the full waiver before signing.");
      return;
    }
    if (!agreed) {
      setError("Check the box to confirm you agree.");
      return;
    }
    if (fullName.trim().length < 3) {
      setError("Type your full legal name as your signature.");
      return;
    }
    setPending(true);
    try {
      await provider.signWaiver({
        userId: currentUser.id,
        fullNameTyped: fullName.trim(),
        agreed: true,
        ip: "127.0.0.1",
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      bump();
      const state = await provider.getOnboardingState(currentUser.id);
      router.push(
        state.nextStep ? `/onboarding/${state.nextStep}` : "/dashboard",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign waiver");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-secondary">
        Step 2 of 3
      </p>
      <PageHero
        eyebrow="Liability waiver"
        title="Read and sign"
        description="You must scroll the full text, type your name, and check the box. A new signature is required whenever the waiver version changes."
      />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mt-8 max-h-[min(55vh,28rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        {waiver ? (
          <>
            <p className="font-display text-xs uppercase tracking-wider text-secondary">
              Version {waiver.version}
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
          <p className="text-secondary">Loading waiver…</p>
        )}
      </div>
      {!scrolledToEnd ? (
        <p className="mt-3 font-display text-sm text-secondary">
          Keep scrolling to unlock the signature fields.
        </p>
      ) : (
        <p className="mt-3 font-display text-sm text-primary-text">
          Full waiver reviewed — you can sign below.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 max-w-lg space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName">Type your full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!scrolledToEnd}
            placeholder={currentUser.displayName}
            required
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-charcoal">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border accent-[var(--color-button)]"
            checked={agreed}
            disabled={!scrolledToEnd}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I have read this waiver (version {waiver?.version ?? "…"}) and agree
            to its terms. My typed name is my electronic signature.
          </span>
        </label>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || !scrolledToEnd}>
          {pending ? "Signing…" : "Sign waiver"}
        </Button>
      </form>
    </PageShell>
  );
}
