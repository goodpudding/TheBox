"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { formatBillingInterval, formatTier } from "@/lib/utils";
import type { Badge, OrgSettings, WaiverSignature } from "@/lib/data";

export default function AccountPage() {
  return (
    <MemberGate>
      <AccountBody />
    </MemberGate>
  );
}

function AccountBody() {
  const { provider, currentUser, refreshUser, bump, revision } = useData();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [waivers, setWaivers] = useState<WaiverSignature[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      setSettings(await provider.getSettings());
      setWaivers(await provider.listWaiverHistory(currentUser.id));
      setBadges(await provider.listBadges(currentUser.id));
    })();
  }, [currentUser, provider, revision]);

  if (!currentUser) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      await provider.updateMemberProfile(currentUser.id, {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        emergencyContactName: String(form.get("emergencyContactName") ?? ""),
        emergencyContactPhone: String(form.get("emergencyContactPhone") ?? ""),
        emergencyContactRelation: String(
          form.get("emergencyContactRelation") ?? "",
        ),
      });
      await refreshUser();
      bump();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Account"
        title="Your membership"
        description="Update contact details anytime. Tier and billing stay read-only here — payments run on the external checkout."
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <StatusPill
          tone={currentUser.status === "active" ? "ok" : "danger"}
        >
          {currentUser.status}
        </StatusPill>
        <StatusPill tone="info">
          {formatTier(currentUser.tier)}
          {currentUser.billingInterval
            ? ` ${formatBillingInterval(currentUser.billingInterval)}`
            : ""}
        </StatusPill>
        <StatusPill tone={currentUser.shopAccess ? "ok" : "muted"}>
          {currentUser.shopAccess ? "Shop access" : "No shop access"}
        </StatusPill>
      </div>

      <div className="mt-6">
        <Button asChild>
          <a
            href={settings?.paymentUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Manage billing
          </a>
        </Button>
      </div>

      <form onSubmit={onSubmit} className="mt-12 max-w-xl space-y-5">
        <p className="eyebrow">Profile</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              defaultValue={currentUser.firstName}
              key={`fn-${currentUser.id}-${revision}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              defaultValue={currentUser.lastName}
              key={`ln-${currentUser.id}-${revision}`}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={currentUser.email} disabled readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            defaultValue={currentUser.phone}
            key={`ph-${currentUser.id}-${revision}`}
          />
        </div>
        <p className="eyebrow pt-4">Emergency contact</p>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Name</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            required
            defaultValue={currentUser.emergencyContactName}
            key={`en-${currentUser.id}-${revision}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Phone</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            required
            defaultValue={currentUser.emergencyContactPhone}
            key={`ep-${currentUser.id}-${revision}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactRelation">Relationship</Label>
          <Input
            id="emergencyContactRelation"
            name="emergencyContactRelation"
            defaultValue={currentUser.emergencyContactRelation}
            key={`er-${currentUser.id}-${revision}`}
          />
        </div>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-primary-text">Saved.</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <section className="mt-16 max-w-2xl">
        <p className="eyebrow">Linked badges</p>
        {badges.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {badges.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-display font-medium text-brown">
                    {b.label ?? "Badge"}
                  </p>
                  <p className="font-mono text-xs text-secondary">{b.uid}</p>
                </div>
                <StatusPill tone={b.active ? "ok" : "danger"}>
                  {b.active ? "Active" : "Inactive"}
                </StatusPill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">
            No badges linked yet. Staff can link one from the admin members
            screen.
          </p>
        )}
      </section>

      <section className="mt-16 max-w-2xl">
        <p className="eyebrow">Waiver history</p>
        {waivers.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {waivers.map((w) => (
              <li key={w.id} className="py-3">
                <p className="font-display font-medium text-brown">
                  Version {w.version}
                </p>
                <p className="text-sm text-secondary">
                  Signed {formatDateTime(w.signedAt)} as {w.fullNameTyped}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">No signatures on file.</p>
        )}
      </section>
    </PageShell>
  );
}
