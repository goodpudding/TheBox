"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/format";
import type {
  Machine,
  MaintenanceBlock,
  Reservation,
  User,
} from "@/lib/data";

const TZ = "America/Los_Angeles";

const selectClassName =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function laDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayBounds(dateKey: string): { from: string; to: string } {
  return {
    from: `${dateKey}T00:00:00-07:00`,
    to: `${dateKey}T23:59:59.999-07:00`,
  };
}

function overlapsRange(
  startsAt: string,
  endsAt: string,
  from: string,
  to: string,
): boolean {
  return (
    new Date(endsAt).getTime() >= new Date(from).getTime() &&
    new Date(startsAt).getTime() <= new Date(to).getTime()
  );
}

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "h:mm a");
  } catch {
    return iso;
  }
}

export default function AdminReservationsPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [date, setDate] = useState(laDateKey());
  const [machines, setMachines] = useState<Machine[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { from, to } = dayBounds(date);
        const [m, mem, res, maint] = await Promise.all([
          provider.listMachines(),
          provider.adminListMembers(),
          provider.listReservations({ from, to }),
          provider.adminListMaintenanceBlocks(),
        ]);
        if (cancelled) return;
        setMachines(m);
        setMembers(mem);
        setReservations(res.filter((r) => r.status === "booked"));
        setMaintenance(
          maint.filter((b) => overlapsRange(b.startsAt, b.endsAt, from, to)),
        );
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load reservations",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, provider, revision]);

  const memberName = useMemo(() => {
    const map = new Map(members.map((u) => [u.id, u.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [members]);

  const byMachine = useMemo(() => {
    return machines.map((machine) => ({
      machine,
      reservations: reservations
        .filter((r) => r.machineId === machine.id)
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
      maintenance: maintenance
        .filter((b) => b.machineId === machine.id)
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
    }));
  }, [machines, reservations, maintenance]);

  async function onCreateReservation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await provider.adminCreateReservation({
        userId: String(form.get("userId") ?? ""),
        machineId: String(form.get("machineId") ?? ""),
        startsAt: fromDatetimeLocalValue(String(form.get("startsAt") ?? "")),
        endsAt: fromDatetimeLocalValue(String(form.get("endsAt") ?? "")),
        createdById: currentUser.id,
      });
      e.currentTarget.reset();
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create reservation");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateMaintenance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await provider.adminUpsertMaintenanceBlock({
        machineId: String(form.get("machineId") ?? ""),
        startsAt: fromDatetimeLocalValue(String(form.get("startsAt") ?? "")),
        endsAt: fromDatetimeLocalValue(String(form.get("endsAt") ?? "")),
        reason: String(form.get("reason") ?? "").trim(),
        createdById: currentUser.id,
      });
      e.currentTarget.reset();
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create maintenance");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(id: string) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      await provider.adminCancelReservation(id, currentUser.id);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  const defaultStart = `${date}T10:00`;
  const defaultEnd = `${date}T11:00`;

  return (
    <AdminShell
      title="Reservations"
      description="A reservation is priority, not exclusivity — someone may still badge in without one."
    >
      <div className="space-y-2 max-w-xs">
        <Label htmlFor="day">Day</Label>
        <Input
          id="day"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-brown" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <form onSubmit={onCreateReservation} className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-brown">
            Create reservation
          </h2>
          <div className="space-y-2">
            <Label htmlFor="res-user">Member</Label>
            <select
              id="res-user"
              name="userId"
              required
              className={selectClassName}
              defaultValue=""
            >
              <option value="" disabled>
                Select member
              </option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-machine">Machine</Label>
            <select
              id="res-machine"
              name="machineId"
              required
              className={selectClassName}
              defaultValue=""
            >
              <option value="" disabled>
                Select machine
              </option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="res-start">Start</Label>
              <Input
                id="res-start"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={defaultStart}
                key={`res-start-${date}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-end">End</Label>
              <Input
                id="res-end"
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={defaultEnd}
                key={`res-end-${date}`}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy || !currentUser}>
            Create reservation
          </Button>
        </form>

        <form onSubmit={onCreateMaintenance} className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-brown">
            Maintenance block
          </h2>
          <div className="space-y-2">
            <Label htmlFor="maint-machine">Machine</Label>
            <select
              id="maint-machine"
              name="machineId"
              required
              className={selectClassName}
              defaultValue=""
            >
              <option value="" disabled>
                Select machine
              </option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maint-start">Start</Label>
              <Input
                id="maint-start"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={toDatetimeLocalValue(
                  `${date}T09:00:00-07:00`,
                )}
                key={`maint-start-${date}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-end">End</Label>
              <Input
                id="maint-end"
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={toDatetimeLocalValue(
                  `${date}T12:00:00-07:00`,
                )}
                key={`maint-end-${date}`}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maint-reason">Reason</Label>
            <Input id="maint-reason" name="reason" required />
          </div>
          <Button type="submit" variant="secondary" disabled={busy || !currentUser}>
            Add maintenance
          </Button>
        </form>
      </div>

      <section className="mt-14 space-y-10">
        <h2 className="font-display text-xl font-semibold text-brown">
          Schedule for {date}
        </h2>
        {byMachine.length === 0 ? (
          <p className="text-secondary">No machines loaded.</p>
        ) : (
          byMachine.map(({ machine, reservations: rows, maintenance: blocks }) => (
            <div key={machine.id}>
              <h3 className="font-display text-lg font-semibold text-brown">
                {machine.name}
              </h3>
              {rows.length === 0 && blocks.length === 0 ? (
                <p className="mt-2 text-sm text-secondary">Nothing scheduled.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {blocks.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                      <StatusPill tone="warn">Maintenance</StatusPill>
                      <span className="text-sm text-charcoal">
                        {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
                      </span>
                      <span className="text-sm text-secondary">{b.reason}</span>
                    </li>
                  ))}
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill tone="info">Reservation</StatusPill>
                        <span className="font-display text-sm font-medium text-brown">
                          {memberName(r.userId)}
                        </span>
                        <span className="text-sm text-charcoal">
                          {formatTime(r.startsAt)} – {formatTime(r.endsAt)}
                        </span>
                        <span className="text-xs text-secondary">
                          {formatDateTime(r.startsAt)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !currentUser}
                        onClick={() => onCancel(r.id)}
                      >
                        Cancel
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </AdminShell>
  );
}
