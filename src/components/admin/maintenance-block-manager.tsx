"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/format";
import type { Machine, MaintenanceBlock } from "@/lib/data";

type Draft = {
  id: string;
  machineId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

/**
 * Every maintenance block that has not finished yet, with a way to change
 * its time or reason and to remove it. Removing one frees the machine for
 * reservations again.
 */
export function MaintenanceBlockManager() {
  const { provider, currentUser, revision, bump } = useData();
  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The list drops blocks that are over. Read the clock once per load.
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      provider.adminListMaintenanceBlocks(),
      provider.adminListMachines(),
    ]).then(([list, machineList]) => {
      if (cancelled) return;
      setBlocks(list);
      setMachines(machineList);
      setLoadedAt(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const upcoming = useMemo(
    () =>
      blocks
        .filter((b) => new Date(b.endsAt).getTime() >= loadedAt)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [blocks, loadedAt],
  );

  const machineName = (id: string) => machines.find((m) => m.id === id)?.name ?? id;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !currentUser) return;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await provider.adminUpsertMaintenanceBlock({
        id: draft.id,
        machineId: draft.machineId,
        startsAt: fromDatetimeLocalValue(draft.startsAt),
        endsAt: fromDatetimeLocalValue(draft.endsAt),
        reason: draft.reason.trim(),
        createdById: currentUser.id,
      });
      setMessage("Maintenance block updated.");
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(block: MaintenanceBlock) {
    if (
      !window.confirm(
        `Remove the maintenance block on ${machineName(block.machineId)}? Members will be able to reserve that time.`,
      )
    ) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await provider.adminDeleteMaintenanceBlock(block.id);
      setMessage("Maintenance block removed.");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    }
  }

  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="font-display text-xl font-semibold text-brown">
        Maintenance blocks
      </h2>
      <p className="mt-2 text-sm text-secondary">
        Current and coming blocks on every machine.
      </p>
      <div className="mt-4">
        <AdminNotice message={message} error={error} />
      </div>

      {draft ? (
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
          <h3 className="font-display text-lg font-semibold text-brown">
            Edit maintenance block
          </h3>
          <div className="space-y-2">
            <Label htmlFor="mb-machine">Machine</Label>
            <select
              id="mb-machine"
              value={draft.machineId}
              onChange={(e) => setDraft({ ...draft, machineId: e.target.value })}
              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mb-start">Starts</Label>
              <Input
                id="mb-start"
                type="datetime-local"
                required
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mb-end">Ends</Label>
              <Input
                id="mb-end"
                type="datetime-local"
                required
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mb-reason">Reason</Label>
            <Input
              id="mb-reason"
              required
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save block"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : upcoming.length === 0 ? (
        <p className="text-secondary">No maintenance is scheduled.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {upcoming.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-display font-semibold text-brown">
                  {machineName(b.machineId)}
                </p>
                <p className="text-sm text-secondary">
                  {formatDateTime(b.startsAt)} – {formatDateTime(b.endsAt)} · {b.reason}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Edit maintenance on ${machineName(b.machineId)}`}
                  onClick={() => {
                    setMessage(null);
                    setError(null);
                    setDraft({
                      id: b.id,
                      machineId: b.machineId,
                      startsAt: toDatetimeLocalValue(b.startsAt),
                      endsAt: toDatetimeLocalValue(b.endsAt),
                      reason: b.reason,
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove maintenance on ${machineName(b.machineId)}`}
                  onClick={() => void onDelete(b)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
