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
import type {
  DisplayMachineStatus,
  Machine,
  MachineArea,
  OrgSettings,
  Reservation,
} from "@/lib/data";

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
  "cnc_plasma",
  "hand_tools",
];

const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
  cnc_plasma: "CNC & plasma",
  hand_tools: "Hand tools",
};

function floorStatusPill(
  status: DisplayMachineStatus["status"] | undefined,
): { tone: "ok" | "warn" | "info" | "muted" | "danger"; label: string } {
  switch (status) {
    case "in_use":
      return { tone: "warn", label: "In use now" };
    case "reserved":
      return { tone: "info", label: "Reserved now" };
    case "maintenance":
      return { tone: "danger", label: "Maintenance" };
    case "available":
      return { tone: "ok", label: "Open now" };
    default:
      return { tone: "muted", label: "Status unknown" };
  }
}

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
  const [floor, setFloor] = useState<DisplayMachineStatus[]>([]);
  const [reservations, setReservations] = useState<
    (Reservation & { machineName?: string })[]
  >([]);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void (async () => {
      const [m, s, res, status] = await Promise.all([
        provider.listMachines(),
        provider.getSettings(),
        provider.listReservations({
          userId: currentUser.id,
          status: "booked",
        }),
        provider.getMachineStatus(),
      ]);
      if (cancelled) return;
      setMachines(m);
      setSettings(s);
      setFloor(status);
      const map = Object.fromEntries(m.map((x) => [x.id, x.name]));
      setReservations(
        res
          .filter((r) => new Date(r.endsAt).getTime() >= Date.now())
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

  const floorById = useMemo(
    () => Object.fromEntries(floor.map((f) => [f.id, f])),
    [floor],
  );

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
        description="See what’s open or booked right now, then pick a time. A reservation is priority — not exclusive lockout."
      />

      {settings ? (
        <p className="mt-6 max-w-2xl text-sm text-secondary leading-relaxed">
          Book up to {settings.reservationHorizonDays} days ahead. Length caps
          depend on the machine (3D printers up to 5 hours). You may hold{" "}
          {settings.maxOpenReservations} open reservation
          {settings.maxOpenReservations === 1 ? "" : "s"} at a time.
        </p>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Your reservations
        </h2>
        {reservations.length === 0 ? (
          <p className="mt-4 text-secondary text-sm">No active reservations.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {reservations.map((r) => {
              const live =
                new Date(r.startsAt).getTime() <= Date.now() &&
                new Date(r.endsAt).getTime() > Date.now();
              return (
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
                    {live ? (
                      <div className="mt-2">
                        <StatusPill tone="warn">Happening now</StatusPill>
                      </div>
                    ) : null}
                  </div>
                  {new Date(r.startsAt).getTime() > Date.now() ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={cancellingId === r.id}
                      onClick={() => void onCancel(r.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </li>
              );
            })}
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
                  {group.machines.map((m) => {
                    const live = floorById[m.id];
                    const pill = floorStatusPill(live?.status);
                    const maxHours =
                      m.maxReservationHours ?? settings?.maxHoursPerDay ?? 3;
                    return (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/reserve/${m.id}`}
                            className="font-display text-base font-semibold text-brown hover:text-primary-text"
                          >
                            {m.name}
                          </Link>
                          <p className="mt-1 text-sm text-secondary">
                            {m.locationLabel || "Shop floor"} · up to {maxHours}{" "}
                            hr
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                            {live?.status === "reserved" && live.reservedAt ? (
                              <StatusPill tone="muted">
                                From {formatTime(live.reservedAt)}
                              </StatusPill>
                            ) : null}
                            {live?.status === "in_use" && live.displayName ? (
                              <StatusPill tone="muted">
                                {live.displayName}
                              </StatusPill>
                            ) : null}
                            {m.reservationRequired ? (
                              <StatusPill tone="warn">
                                Reservation required
                              </StatusPill>
                            ) : null}
                          </div>
                        </div>
                        <Link
                          href={`/reserve/${m.id}`}
                          className="font-display text-sm font-semibold text-primary-text hover:underline"
                        >
                          See times →
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
