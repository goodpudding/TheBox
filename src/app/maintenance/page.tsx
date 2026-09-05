"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
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
  ToolChampionProgress,
} from "@/lib/data";

export default function MaintenancePage() {
  return (
    <MemberGate>
      <MaintenanceBody />
    </MemberGate>
  );
}

function MaintenanceBody() {
  const { provider, currentUser, revision, bump } = useData();
  const [progress, setProgress] = useState<ToolChampionProgress | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void (async () => {
      const [p, m, b] = await Promise.all([
        provider.getToolChampionProgress(currentUser.id),
        provider.listMachines(),
        provider.adminListMaintenanceBlocks(),
      ]);
      if (cancelled) return;
      setProgress(p);
      setMachines(m.filter((x) => x.active));
      setBlocks(
        b
          .filter((x) => new Date(x.endsAt).getTime() >= Date.now())
          .sort(
            (a, c) =>
              new Date(a.startsAt).getTime() - new Date(c.startsAt).getTime(),
          ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, provider, revision]);

  const allowedMachines = useMemo(() => {
    if (!progress) return [];
    if (progress.maintenanceMachineIds === "all") return machines;
    const set = new Set(progress.maintenanceMachineIds);
    return machines.filter((m) => set.has(m.id));
  }, [machines, progress]);

  const machineName = useMemo(() => {
    const map = new Map(machines.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? id;
  }, [machines]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setPending(true);
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
      bump();
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  if (progress && !progress.canScheduleMaintenance) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Maintenance"
          title="Machine downtime"
          description="Shop Stewards and active Tool Champions can block machines for cleaning, repair, or training setup."
        />
        <p className="mt-8 max-w-xl text-secondary leading-relaxed">
          You don&apos;t have maintenance scheduling yet.{" "}
          <Link href="/volunteer" className="text-primary-text underline">
            Apply as a Tool Champion
          </Link>{" "}
          (or ask staff about Shop Steward shifts).
        </p>
      </PageShell>
    );
  }

  const defaultStart = toDatetimeLocalValue(new Date().toISOString());

  return (
    <PageShell>
      <PageHero
        eyebrow="Maintenance"
        title="Block a machine"
        description="Reserve downtime so members can’t book over cleaning, blade changes, or repair. Shop Stewards can cover any machine; Tool Champions cover the ones they’re championing."
      />

      <form onSubmit={onSubmit} className="mt-10 max-w-xl space-y-5">
        <div className="space-y-2">
          <Label htmlFor="machineId">Machine</Label>
          <select
            id="machineId"
            name="machineId"
            required
            className="flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {allowedMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={defaultStart}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endsAt">Ends</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            name="reason"
            required
            placeholder="Blade change, deep clean, alignment…"
          />
        </div>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Schedule maintenance"}
        </Button>
      </form>

      <section className="mt-16">
        <p className="eyebrow">Upcoming blocks</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          On the calendar
        </h2>
        {blocks.length === 0 ? (
          <p className="mt-4 text-secondary">No upcoming maintenance blocks.</p>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {blocks.map((b) => (
              <li key={b.id} className="py-4">
                <p className="font-display text-lg font-semibold text-brown">
                  {machineName(b.machineId)}
                </p>
                <p className="mt-1 text-sm text-secondary">
                  {formatDateTime(b.startsAt)} – {formatDateTime(b.endsAt)}
                </p>
                <p className="mt-1 text-secondary">{b.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
