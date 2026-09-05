"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AvailabilitySlot,
  Machine,
  OrgSettings,
} from "@/lib/data";

const TZ = "America/Los_Angeles";

function laDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + days));
  return utc.toISOString().slice(0, 10);
}

function formatSlotTime(iso: string): string {
  try {
    return format(parseISO(iso), "h:mm a");
  } catch {
    return iso;
  }
}

function reasonLabel(reason?: AvailabilitySlot["reason"]): string {
  switch (reason) {
    case "reserved":
      return "Reserved";
    case "maintenance":
      return "Maintenance";
    case "closed":
      return "Closed";
    case "past":
      return "Past";
    default:
      return "Unavailable";
  }
}

export default function ReserveMachinePage() {
  return (
    <MemberGate>
      <ReserveMachineBody />
    </MemberGate>
  );
}

function ReserveMachineBody() {
  const params = useParams();
  const machineId =
    typeof params.machineId === "string" ? params.machineId : "";
  const router = useRouter();
  const { provider, currentUser, revision, bump } = useData();

  const [machine, setMachine] = useState<Machine | null | undefined>(undefined);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [date, setDate] = useState(laDateKey());
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [durationSlots, setDurationSlots] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;
    void (async () => {
      const [machines, s] = await Promise.all([
        provider.listMachines(),
        provider.getSettings(),
      ]);
      if (cancelled) return;
      setSettings(s);
      setMachine(machines.find((m) => m.id === machineId) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [machineId, provider, revision]);

  useEffect(() => {
    if (!machineId || !date) return;
    let cancelled = false;
    setSlots(null);
    setSelectedStart(null);
    setError(null);
    void (async () => {
      try {
        // Same-day range: from/to are ISODate (YYYY-MM-DD).
        const rows = await provider.getMachineAvailability(
          machineId,
          date,
          date,
        );
        if (!cancelled) setSlots(rows);
      } catch (e) {
        if (!cancelled) {
          setSlots([]);
          setError(
            e instanceof Error ? e.message : "Failed to load availability",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machineId, date, provider, revision]);

  const displaySlots = useMemo(() => {
    if (!slots) return null;
    // Keep open-hours window (available + reserved/maintenance/past); drop overnight closed noise.
    const openish = slots.filter(
      (s) => s.available || s.reason !== "closed",
    );
    return openish.length > 0 ? openish : slots;
  }, [slots]);

  const maxContiguous = useMemo(() => {
    if (!displaySlots || !selectedStart) return 0;
    const startIdx = displaySlots.findIndex((s) => s.startsAt === selectedStart);
    if (startIdx < 0) return 0;
    let count = 0;
    for (let i = startIdx; i < displaySlots.length; i++) {
      if (!displaySlots[i]?.available) break;
      count += 1;
    }
    return count;
  }, [displaySlots, selectedStart]);

  useEffect(() => {
    if (!selectedStart || maxContiguous <= 0) return;
    const preferred = Math.min(2, maxContiguous);
    setDurationSlots((prev) =>
      prev > maxContiguous ? preferred : Math.max(1, Math.min(prev, maxContiguous)),
    );
  }, [selectedStart, maxContiguous]);

  const endsAt = useMemo(() => {
    if (!displaySlots || !selectedStart || durationSlots < 1) return null;
    const startIdx = displaySlots.findIndex((s) => s.startsAt === selectedStart);
    if (startIdx < 0) return null;
    const endSlot = displaySlots[startIdx + durationSlots - 1];
    return endSlot?.endsAt ?? null;
  }, [displaySlots, selectedStart, durationSlots]);

  const maxDate = settings
    ? addDaysToDateKey(laDateKey(), settings.reservationHorizonDays)
    : addDaysToDateKey(laDateKey(), 14);

  function pickStart(slot: AvailabilitySlot) {
    if (!slot.available) return;
    setSelectedStart(slot.startsAt);
    setError(null);
    setSuccess(false);
    if (!displaySlots) return;
    const startIdx = displaySlots.findIndex((s) => s.startsAt === slot.startsAt);
    let contiguous = 0;
    for (let i = startIdx; i < displaySlots.length; i++) {
      if (!displaySlots[i]?.available) break;
      contiguous += 1;
    }
    setDurationSlots(Math.min(2, Math.max(1, contiguous)));
  }

  async function onReserve() {
    if (!currentUser || !selectedStart || !endsAt) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await provider.reserve({
        userId: currentUser.id,
        machineId,
        startsAt: selectedStart,
        endsAt,
      });
      bump();
      setSuccess(true);
      router.push("/reserve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reservation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return null;

  if (machine === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading machine…</p>
      </PageShell>
    );
  }

  if (!machine) {
    return (
      <PageShell>
        <PageHero eyebrow="Reserve" title="Machine not found" />
        <p className="mt-6">
          <Link
            href="/reserve"
            className="font-display text-sm font-semibold text-primary-text hover:underline"
          >
            ← Back to machines
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <p className="mb-6">
        <Link
          href="/reserve"
          className="font-display text-sm font-semibold text-primary-text hover:underline"
        >
          ← All machines
        </Link>
      </p>

      <PageHero
        eyebrow="Reserve"
        title={machine.name}
        description="Choose a date, then a start time. Duration is in 30-minute steps up to contiguous open slots. Priority hold — not exclusive lockout."
      />

      <div className="mt-10 max-w-xs space-y-2">
        <Label htmlFor="reserve-date">Date</Label>
        <Input
          id="reserve-date"
          type="date"
          value={date}
          min={laDateKey()}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-brown">
          Time slots
        </h2>
        {displaySlots === null ? (
          <p className="mt-4 text-secondary text-sm">Loading availability…</p>
        ) : displaySlots.length === 0 ? (
          <p className="mt-4 text-secondary text-sm">
            No slots for this date.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {displaySlots.map((slot) => {
              const selected = selectedStart === slot.startsAt;
              const disabled = !slot.available;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  disabled={disabled}
                  title={
                    disabled
                      ? reasonLabel(slot.reason)
                      : formatSlotTime(slot.startsAt)
                  }
                  onClick={() => pickStart(slot)}
                  className={
                    disabled
                      ? "rounded-full border border-border/60 bg-border/30 px-3 py-2 font-display text-xs text-secondary cursor-not-allowed"
                      : selected
                        ? "rounded-full bg-button px-3 py-2 font-display text-xs font-semibold text-white"
                        : "rounded-full border border-border bg-surface px-3 py-2 font-display text-xs font-medium text-brown hover:border-brown/40"
                  }
                >
                  {formatSlotTime(slot.startsAt)}
                  {disabled ? (
                    <span className="ml-1 opacity-80">
                      · {reasonLabel(slot.reason)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedStart && maxContiguous > 0 ? (
        <section className="mt-10 max-w-md">
          <h2 className="font-display text-lg font-semibold text-brown">
            Duration
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Starting {formatSlotTime(selectedStart)}. Pick how long (30-minute
            steps).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: maxContiguous }, (_, i) => i + 1).map(
              (n) => {
                const minutes = n * (settings?.reservationSlotMinutes ?? 30);
                const label =
                  minutes < 60
                    ? `${minutes} min`
                    : minutes % 60 === 0
                      ? `${minutes / 60} hr`
                      : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDurationSlots(n)}
                    className={
                      durationSlots === n
                        ? "rounded-full bg-button px-4 py-2 font-display text-sm font-semibold text-white"
                        : "rounded-full border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-brown hover:border-brown/40"
                    }
                  >
                    {label}
                  </button>
                );
              },
            )}
          </div>
          {endsAt ? (
            <p className="mt-4 text-sm text-charcoal">
              Ends {formatSlotTime(endsAt)}
            </p>
          ) : null}
          <div className="mt-6">
            <Button
              type="button"
              disabled={busy || !endsAt}
              onClick={() => void onReserve()}
            >
              Reserve
            </Button>
          </div>
        </section>
      ) : null}

      {success ? (
        <p className="mt-6 text-sm text-charcoal" role="status">
          Reservation saved.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 text-sm text-brown" role="alert">
          {error}
        </p>
      ) : null}
    </PageShell>
  );
}
