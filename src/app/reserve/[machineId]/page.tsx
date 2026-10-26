"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
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

type TimelineBlock = {
  key: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  reason?: AvailabilitySlot["reason"];
  slotCount: number;
  /** First slot index in displaySlots for available blocks. */
  startIndex: number;
};

function collapseSlots(slots: AvailabilitySlot[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const reason = slot.available ? undefined : slot.reason;
    const last = blocks[blocks.length - 1];
    const same =
      last &&
      last.available === slot.available &&
      last.reason === reason &&
      last.endsAt === slot.startsAt;
    if (same && last) {
      last.endsAt = slot.endsAt;
      last.slotCount += 1;
    } else {
      blocks.push({
        key: `${slot.startsAt}-${slot.available}-${reason ?? "open"}`,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        available: slot.available,
        reason,
        slotCount: 1,
        startIndex: i,
      });
    }
  }
  return blocks;
}

function blockLabel(block: TimelineBlock): string {
  if (block.available) return "Open";
  switch (block.reason) {
    case "reserved":
      return "Booked";
    case "maintenance":
      return "Maintenance";
    case "past":
      return "Past";
    case "closed":
      return "Closed";
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

  const slotMinutes = settings?.reservationSlotMinutes ?? 30;

  const displaySlots = useMemo(() => {
    if (!slots) return null;
    const openish = slots.filter((s) => s.available || s.reason !== "closed");
    return openish.length > 0 ? openish : slots;
  }, [slots]);

  const blocks = useMemo(
    () => (displaySlots ? collapseSlots(displaySlots) : []),
    [displaySlots],
  );

  const bookedBlocks = useMemo(
    () => blocks.filter((b) => !b.available && b.reason === "reserved"),
    [blocks],
  );

  const machineMaxHours =
    machine?.maxReservationHours ?? settings?.maxHoursPerDay ?? 3;
  const maxDurationSlots = Math.max(
    1,
    Math.floor((machineMaxHours * 60) / slotMinutes),
  );

  const maxContiguous = useMemo(() => {
    if (!displaySlots || !selectedStart) return 0;
    const startIdx = displaySlots.findIndex((s) => s.startsAt === selectedStart);
    if (startIdx < 0) return 0;
    let count = 0;
    for (let i = startIdx; i < displaySlots.length; i++) {
      if (!displaySlots[i]?.available) break;
      count += 1;
      if (count >= maxDurationSlots) break;
    }
    return count;
  }, [displaySlots, selectedStart, maxDurationSlots]);

  useEffect(() => {
    if (!selectedStart || maxContiguous <= 0) return;
    const preferred = Math.min(2, maxContiguous);
    setDurationSlots((prev) =>
      prev > maxContiguous
        ? preferred
        : Math.max(1, Math.min(prev, maxContiguous)),
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

  function pickStart(startsAt: string) {
    if (!displaySlots) return;
    const startIdx = displaySlots.findIndex((s) => s.startsAt === startsAt);
    const slot = displaySlots[startIdx];
    if (!slot?.available) return;
    setSelectedStart(startsAt);
    setError(null);
    setSuccess(false);
    let contiguous = 0;
    for (let i = startIdx; i < displaySlots.length; i++) {
      if (!displaySlots[i]?.available) break;
      contiguous += 1;
      if (contiguous >= maxDurationSlots) break;
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
        description={`${machine.locationLabel || "Shop floor"} · book up to ${machineMaxHours} hours. Priority hold — not exclusive lockout.`}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        <StatusPill tone="info">Max {machineMaxHours} hr</StatusPill>
        {machine.attendedOperationRequired ? (
          <StatusPill tone="warn">Must attend while running</StatusPill>
        ) : (
          <StatusPill tone="muted">May run unattended</StatusPill>
        )}
      </div>

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
          Day timeline
        </h2>
        <p className="mt-2 text-sm text-secondary">
          Booked blocks show as solid ranges. Tap an open block to choose a
          start time.
        </p>

        {displaySlots === null ? (
          <p className="mt-4 text-secondary text-sm">Loading availability…</p>
        ) : displaySlots.length === 0 ? (
          <p className="mt-4 text-secondary text-sm">No slots for this date.</p>
        ) : (
          <div className="mt-5 space-y-2">
            {blocks.map((block) => {
              const selectedInBlock =
                selectedStart != null &&
                selectedStart >= block.startsAt &&
                selectedStart < block.endsAt &&
                block.available;
              const range = `${formatSlotTime(block.startsAt)} – ${formatSlotTime(block.endsAt)}`;

              if (!block.available) {
                return (
                  <div
                    key={block.key}
                    className={
                      block.reason === "reserved"
                        ? "rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3"
                        : block.reason === "maintenance"
                          ? "rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3"
                          : "rounded-2xl border border-border bg-border/20 px-4 py-3"
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-sm font-semibold text-brown">
                        {blockLabel(block)}
                      </p>
                      <p className="font-display text-sm text-charcoal">
                        {range}
                      </p>
                    </div>
                  </div>
                );
              }

              // Expand available block into start-time chips (cleaner than one giant button).
              const startOptions = displaySlots.slice(
                block.startIndex,
                block.startIndex + block.slotCount,
              );
              return (
                <div
                  key={block.key}
                  className={
                    selectedInBlock
                      ? "rounded-2xl border border-button/40 bg-surface px-4 py-3"
                      : "rounded-2xl border border-border bg-surface/70 px-4 py-3"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold text-brown">
                      Open
                    </p>
                    <p className="text-sm text-secondary">{range}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {startOptions.map((slot) => {
                      const selected = selectedStart === slot.startsAt;
                      return (
                        <button
                          key={slot.startsAt}
                          type="button"
                          onClick={() => pickStart(slot.startsAt)}
                          className={
                            selected
                              ? "rounded-full bg-button px-3 py-1.5 font-display text-xs font-semibold text-white"
                              : "rounded-full border border-border bg-page px-3 py-1.5 font-display text-xs font-medium text-brown hover:border-brown/40"
                          }
                        >
                          Start {formatSlotTime(slot.startsAt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bookedBlocks.length > 0 ? (
          <p className="mt-4 text-sm text-secondary">
            {bookedBlocks.length} booked block
            {bookedBlocks.length === 1 ? "" : "s"} on this day
            {bookedBlocks.some(
              (b) =>
                new Date(b.startsAt).getTime() <= Date.now() &&
                new Date(b.endsAt).getTime() > Date.now(),
            )
              ? " · including a hold happening now"
              : ""}
            .
          </p>
        ) : displaySlots && displaySlots.length > 0 ? (
          <p className="mt-4 text-sm text-secondary">
            No reservations on this day yet.
          </p>
        ) : null}
      </section>

      {selectedStart && maxContiguous > 0 ? (
        <section className="mt-10 max-w-lg">
          <h2 className="font-display text-lg font-semibold text-brown">
            How long?
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Starting {formatSlotTime(selectedStart)}. Up to {machineMaxHours}{" "}
            hours on this machine ({slotMinutes}-minute steps).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: maxContiguous }, (_, i) => i + 1).map((n) => {
              const minutes = n * slotMinutes;
              const label =
                minutes < 60
                  ? `${minutes} min`
                  : minutes % 60 === 0
                    ? `${minutes / 60} hr`
                    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
            })}
          </div>
          {endsAt ? (
            <p className="mt-4 text-sm text-charcoal">
              Hold: {formatSlotTime(selectedStart)} – {formatSlotTime(endsAt)}
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
