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
import type { CreditWallet, OrgSettings, WaiverSignature } from "@/lib/data";
import { CreditWalletPanel } from "@/components/credit-wallet";

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
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [pinPending, setPinPending] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      try {
        setSettings(await provider.getSettings());
        setWaivers(await provider.listWaiverHistory(currentUser.id));
        setWallet(await provider.getCreditWallet(currentUser.id));
        setPinSet(Boolean(currentUser.kioskPinSet));
        const pinRes = await fetch("/api/account/kiosk-pin", {
          headers: { "x-box-user-id": currentUser.id },
          cache: "no-store",
        });
        if (pinRes.ok) {
          const body = (await pinRes.json()) as { pinSet?: boolean };
          if (body.pinSet) setPinSet(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your account");
      }
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

  async function onSavePin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setPinPending(true);
    setPinError(null);
    setPinMessage(null);
    const form = e.currentTarget;
    const pin = String(form.get("pin") ?? "");
    const confirmPin = String(form.get("confirmPin") ?? "");
    if (pin !== confirmPin) {
      setPinError("PINs don't match.");
      setPinPending(false);
      return;
    }
    try {
      await provider.setMyKioskPin(currentUser.id, pin);
      const res = await fetch("/api/account/kiosk-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-box-user-id": currentUser.id,
        },
        body: JSON.stringify({ pin }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not save shop PIN");
      }
      setPinSet(true);
      setPinMessage("Shop PIN saved.");
      form.reset();
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Could not save shop PIN");
    } finally {
      setPinPending(false);
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

      {wallet ? (
        <div className="mt-10 max-w-2xl">
          <CreditWalletPanel wallet={wallet} />
        </div>
      ) : null}

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

      <section className="mt-16 max-w-xl">
        <p className="eyebrow">Shop PIN</p>
        <p className="mt-3 text-secondary leading-relaxed">
          Use this with the email on your membership to sign in at any shop PC.
          4–6 digits.
        </p>
        {pinSet ? (
          <p className="mt-4 font-display font-semibold text-brown">
            PIN is set · Change PIN
          </p>
        ) : null}
        <form onSubmit={onSavePin} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-pin">{pinSet ? "New PIN" : "PIN"}</Label>
            <Input
              id="shop-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              autoComplete="off"
              required
              minLength={4}
              maxLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-pin-confirm">Confirm PIN</Label>
            <Input
              id="shop-pin-confirm"
              name="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              autoComplete="off"
              required
              minLength={4}
              maxLength={6}
            />
          </div>
          {pinError ? (
            <p className="text-sm text-accent" role="alert">
              {pinError}
            </p>
          ) : null}
          {pinMessage ? (
            <p className="text-sm text-primary-text">{pinMessage}</p>
          ) : null}
          <Button type="submit" disabled={pinPending}>
            {pinPending ? "Saving…" : pinSet ? "Change PIN" : "Save PIN"}
          </Button>
        </form>
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
