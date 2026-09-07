"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { MachineQr } from "@/components/machine-qr";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgSettings } from "@/lib/data";

function publicUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${path}`;
}

export default function AdminSettingsPage() {
  const { provider, revision, bump } = useData();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const registrationUrl = useMemo(() => publicUrl("/register"), []);

  useEffect(() => {
    void (async () => {
      setSettings(await provider.getSettings());
    })();
  }, [provider, revision]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await provider.adminUpdateSettings({
        orgName: String(form.get("orgName") ?? ""),
        paymentUrl: String(form.get("paymentUrl") ?? ""),
        donationUrl: String(form.get("donationUrl") ?? ""),
        scholarshipDonationUrl: String(
          form.get("scholarshipDonationUrl") ?? "",
        ),
        contactEmail: String(form.get("contactEmail") ?? ""),
        quizPassThresholdPercent: Number(
          form.get("quizPassThresholdPercent") ?? 0,
        ),
        quizAttemptLimit: Number(form.get("quizAttemptLimit") ?? 0),
        quizQuestionCount: Number(form.get("quizQuestionCount") ?? 0),
        classCancellationCutoffHours: Number(
          form.get("classCancellationCutoffHours") ?? 0,
        ),
        paymentHoldHours: Number(form.get("paymentHoldHours") ?? 0),
        reservationHorizonDays: Number(
          form.get("reservationHorizonDays") ?? 0,
        ),
        maxHoursPerDay: Number(form.get("maxHoursPerDay") ?? 0),
        maxOpenReservations: Number(form.get("maxOpenReservations") ?? 0),
        reservationSlotMinutes: Number(
          form.get("reservationSlotMinutes") ?? 0,
        ),
        communitySeatCap: Number(form.get("communitySeatCap") ?? 0),
        makerMonthlyCents: Number(form.get("makerMonthlyCents") ?? 0),
        patronScholarshipSurchargeCents: Number(
          form.get("patronScholarshipSurchargeCents") ?? 0,
        ),
        scholarshipFundBalanceCents: Number(
          form.get("scholarshipFundBalanceCents") ?? 0,
        ),
        scholarshipSeatsAwarded: Number(
          form.get("scholarshipSeatsAwarded") ?? 0,
        ),
        currentWaiverVersion: String(form.get("currentWaiverVersion") ?? ""),
        showPhase3Tiers: form.get("showPhase3Tiers") === "on",
      });
      setSettings(updated);
      bump();
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  if (!settings) {
    return (
      <AdminShell title="Settings">
        <p className="text-secondary">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Org settings"
      description="Checkout links, quiz defaults, reservation limits, and scholarship fund knobs."
    >
      {error ? (
        <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-brown">
          {message}
        </p>
      ) : null}

      <section className="mb-12 max-w-3xl rounded-3xl border border-border bg-surface/70 p-6">
        <p className="eyebrow">Walk-in registration</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          QR code for account + waiver
        </h2>
        <p className="mt-3 max-w-2xl text-secondary leading-relaxed">
          Post this near the entrance so visitors can scan it when they arrive,
          create their account record, sign the current waiver, and choose
          whether they want the newsletter.
        </p>
        <p className="mt-4 break-all font-mono text-sm text-secondary">
          {registrationUrl}
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-5">
          <MachineQr
            url={registrationUrl}
            label="The Box walk-in registration"
          />
          <Button asChild variant="secondary" size="sm">
            <a href={registrationUrl} target="_blank" rel="noreferrer">
              Open registration page
            </a>
          </Button>
        </div>
      </section>

      <form
        key={settings.updatedAt}
        onSubmit={onSave}
        className="max-w-xl space-y-5"
      >
        <Field
          id="orgName"
          label="Org name"
          defaultValue={settings.orgName}
        />
        <Field
          id="paymentUrl"
          label="Payment URL"
          defaultValue={settings.paymentUrl}
        />
        <Field
          id="donationUrl"
          label="Donation URL"
          defaultValue={settings.donationUrl}
        />
        <Field
          id="scholarshipDonationUrl"
          label="Scholarship donation URL"
          defaultValue={settings.scholarshipDonationUrl}
        />
        <Field
          id="contactEmail"
          label="Contact email"
          type="email"
          defaultValue={settings.contactEmail}
        />
        <Field
          id="currentWaiverVersion"
          label="Current waiver version"
          defaultValue={settings.currentWaiverVersion}
        />

        <p className="pt-4 font-display text-sm font-semibold uppercase tracking-wider text-secondary">
          Quiz defaults
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field
            id="quizPassThresholdPercent"
            label="Pass %"
            type="number"
            defaultValue={String(settings.quizPassThresholdPercent)}
          />
          <Field
            id="quizAttemptLimit"
            label="Attempt limit"
            type="number"
            defaultValue={String(settings.quizAttemptLimit)}
          />
          <Field
            id="quizQuestionCount"
            label="Question count"
            type="number"
            defaultValue={String(settings.quizQuestionCount)}
          />
        </div>

        <p className="pt-4 font-display text-sm font-semibold uppercase tracking-wider text-secondary">
          Classes & payment
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="classCancellationCutoffHours"
            label="Cancel cutoff (hours)"
            type="number"
            defaultValue={String(settings.classCancellationCutoffHours)}
          />
          <Field
            id="paymentHoldHours"
            label="Payment hold (hours)"
            type="number"
            defaultValue={String(settings.paymentHoldHours)}
          />
        </div>

        <p className="pt-4 font-display text-sm font-semibold uppercase tracking-wider text-secondary">
          Reservation limits
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="reservationHorizonDays"
            label="Horizon (days)"
            type="number"
            defaultValue={String(settings.reservationHorizonDays)}
          />
          <Field
            id="maxHoursPerDay"
            label="Max hours / day"
            type="number"
            defaultValue={String(settings.maxHoursPerDay)}
          />
          <Field
            id="maxOpenReservations"
            label="Max open reservations"
            type="number"
            defaultValue={String(settings.maxOpenReservations)}
          />
          <Field
            id="reservationSlotMinutes"
            label="Slot minutes"
            type="number"
            defaultValue={String(settings.reservationSlotMinutes)}
          />
        </div>

        <p className="pt-4 font-display text-sm font-semibold uppercase tracking-wider text-secondary">
          Community & scholarship
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="communitySeatCap"
            label="Community seat cap"
            type="number"
            defaultValue={String(settings.communitySeatCap)}
          />
          <Field
            id="makerMonthlyCents"
            label="Maker monthly (¢)"
            type="number"
            defaultValue={String(settings.makerMonthlyCents)}
          />
          <Field
            id="patronScholarshipSurchargeCents"
            label="Patron surcharge (¢)"
            type="number"
            defaultValue={String(settings.patronScholarshipSurchargeCents)}
          />
          <Field
            id="scholarshipFundBalanceCents"
            label="Fund balance (¢)"
            type="number"
            defaultValue={String(settings.scholarshipFundBalanceCents)}
          />
          <Field
            id="scholarshipSeatsAwarded"
            label="Seats awarded"
            type="number"
            defaultValue={String(settings.scholarshipSeatsAwarded)}
          />
        </div>

        <label className="flex items-center gap-2 pt-2 font-display text-sm text-brown">
          <input
            type="checkbox"
            name="showPhase3Tiers"
            className="size-4"
            defaultChecked={settings.showPhase3Tiers}
          />
          Show Phase 3 tiers on Join
        </label>

        <div className="rounded-2xl border border-border bg-surface/60 px-4 py-4">
          <p className="font-display text-sm font-semibold text-brown">
            Lobby display token
          </p>
          <p className="mt-2 text-sm text-secondary">
            Set DISPLAY_TOKEN and NEXT_PUBLIC_DISPLAY_TOKEN in .env to the same
            long random value. Manage promos and panel rotation under Admin →
            Display.
          </p>
        </div>

        <Button type="submit" disabled={pending} className="mt-4">
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </AdminShell>
  );
}

function Field({
  id,
  label,
  defaultValue,
  type = "text",
}: {
  id: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} defaultValue={defaultValue} required />
    </div>
  );
}
