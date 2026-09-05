"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { formatDateTime } from "@/lib/format";
import type { Machine, MachineArea, OrgSettings, Reservation } from "@/lib/data";

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "h:mm a");
  } catch {
    return iso;
  }
}

const AREA_ORDER: MachineArea[] = [
  "3d_printing",
  "laser",
  "woodshop",
  "textiles_vinyl",
  "sublimation",
];

const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
};

export default function ReservePage() {
  return (
    <MemberGate>
      <ReserveBody />
    </MemberGate>
  );
}

function ReserveBody() {
  const { provider, currentUser, revision, bump } = useData();
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [reservations, setReservations] = useState<
    (Reservation & { machineName?: string })[]
  >([]);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void (async () => {
      const [m, s, res] = await Promise.all([
        provider.listMachines(),
        provider.getSettings(),
        provider.listReservations({
          userId: currentUser.id,
          status: "booked",
        }),
      ]);
      if (cancelled) return;
      setMachines(m);
      setSettings(s);
      const map = Object.fromEntries(m.map((x) => [x.id, x.name]));
      setReservations(
        res
          .filter((r) => new Date(r.startsAt).getTime() >= Date.now())
          .sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          )
          .map((r) => ({ ...r, machineName: map[r.machineId] })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, provider, revision]);

  const grouped = useMemo(() => {
    if (!machines) return null;
    return AREA_ORDER.map((area) => ({
      area,
      label: AREA_LABEL[area],
      machines: machines.filter((m) => m.area === area),
    })).filter((g) => g.machines.length > 0);
  }, [machines]);

  async function onCancel(id: string) {
    if (!currentUser) return;
    setCancellingId(id);
    setCancelError(null);
    try {
      await provider.cancelReservation(id, currentUser.id);
      bump();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  }

  if (!currentUser) return null;

  return (
    <PageShell>
      <PageHero
        eyebrow="Reserve"
        title="Machine priority holds"
        description="A reservation signals priority for that machine — it is not exclusive lockout. Walk-ups may still use open equipment when no one with a hold is present."
      />

      {settings ? (
        <p className="mt-6 max-w-2xl text-sm text-secondary leading-relaxed">
          Book up to {settings.reservationHorizonDays} days ahead,{" "}
          {settings.maxHoursPerDay} hours per day, and{" "}
          {settings.maxOpenReservations} open reservation
          {settings.maxOpenReservations === 1 ? "" : "s"} at a time. Slots are{" "}
          {settings.reservationSlotMinutes} minutes.
        </p>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Your upcoming reservations
        </h2>
        {reservations.length === 0 ? (
          <p className="mt-4 text-secondary text-sm">
            No upcoming reservations.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {reservations.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-display font-semibold text-brown">
                    {r.machineName ?? r.machineId}
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    {formatDateTime(r.startsAt)} – {formatTime(r.endsAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={cancellingId === r.id}
                  onClick={() => void onCancel(r.id)}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        )}
        {cancelError ? (
          <p className="mt-3 text-sm text-brown" role="alert">
            {cancelError}
          </p>
        ) : null}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold text-brown">
          Machines
        </h2>
        {grouped === null ? (
          <p className="mt-4 text-secondary">Loading machines…</p>
        ) : grouped.length === 0 ? (
          <p className="mt-4 text-secondary">No active machines.</p>
        ) : (
          <div className="mt-8 space-y-10">
            {grouped.map((group) => (
              <div key={group.area}>
                <h3 className="font-display text-lg font-semibold text-charcoal">
                  {group.label}
                </h3>
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {group.machines.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div>
                        <Link
                          href={`/reserve/${m.id}`}
                          className="font-display text-base font-semibold text-brown hover:text-primary-text"
                        >
                          {m.name}
                        </Link>
                        {m.reservationRequired ? (
                          <div className="mt-2">
                            <StatusPill tone="warn">
                              Reservation required
                            </StatusPill>
                          </div>
                        ) : m.reservationRecommended ? (
                          <div className="mt-2">
                            <StatusPill tone="info">
                              Reservation recommended
                            </StatusPill>
                          </div>
                        ) : null}
                      </div>
                      <Link
                        href={`/reserve/${m.id}`}
                        className="font-display text-sm font-semibold text-primary-text hover:underline"
                      >
                        Pick a time →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
