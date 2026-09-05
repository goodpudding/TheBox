"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type { ContentPage, OrgSettings } from "@/lib/data";

export default function OnboardingExpectationsPage() {
  return (
    <MemberGate requireOnboardingComplete={false}>
      <ExpectationsForm />
    </MemberGate>
  );
}

function ExpectationsForm() {
  const { provider, currentUser, bump } = useData();
  const router = useRouter();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [policy, setPolicy] = useState<ContentPage | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await provider.getSettings();
      setSettings(s);
      setPolicy(
        await provider.getContentBySlug(s.memberExpectationsPolicySlug),
      );
    })();
  }, [provider]);

  if (!currentUser) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !policy || !settings) return;
    if (!agreed) {
      setError("Please confirm you understand the member expectations.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await provider.acknowledgePolicy({
        userId: currentUser.id,
        policySlug: settings.memberExpectationsPolicySlug,
        version: policy.version,
      });
      bump();
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save acknowledgement",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-secondary">
        Step 3 of 3
      </p>
      <PageHero
        eyebrow="House rules"
        title="Member expectations"
        description="Acknowledge the safety, cleanup, and certification rules. We’ll ask again if this policy version changes."
      />

      <div className="mt-8 max-w-3xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
        {policy ? (
          <>
            <p className="font-display text-xs uppercase tracking-wider text-secondary">
              Version {policy.version}
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-brown">
              {policy.title}
            </h2>
            <div
              className="prose-cms mt-4"
              dangerouslySetInnerHTML={{ __html: policy.html }}
            />
          </>
        ) : (
          <p className="text-secondary">Loading policy…</p>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-8 max-w-lg space-y-5">
        <label className="flex items-start gap-3 text-sm text-charcoal">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border accent-[var(--color-button)]"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I have read and agree to follow the member expectations (version{" "}
            {policy?.version ?? "…"}).
          </span>
        </label>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || !policy}>
          {pending ? "Saving…" : "Acknowledge and go to dashboard"}
        </Button>
      </form>
    </PageShell>
  );
}
