"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/utils";
import type { ClassCategory, ClassSessionView } from "@/lib/data";

const CATEGORY_LABEL: Record<ClassCategory, string> = {
  orientation: "Orientation",
  certification_checkoff: "Certification checkoff",
  workshop: "Workshop",
  open_studio: "Open studio",
};

export default function AdminClassesPage() {
  const { provider, revision, bump } = useData();
  const [classes, setClasses] = useState<ClassSessionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/sync/zeffy", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { lastSyncedAt?: string | null } | null) => {
        setLastSyncedAt(body?.lastSyncedAt ?? null);
      })
      .catch(() => setLastSyncedAt(null));
  }, [revision]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await provider.listClasses({
          includeCancelled: true,
          includeImported: true,
        });
        if (!cancelled) {
          setClasses(rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load classes");
          setClasses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/zeffy", { method: "POST" });
      const body = (await res.json()) as {
        error?: string;
        created?: number;
        updated?: number;
        cancelled?: number;
        pulled?: number;
        lastSyncedAt?: string | null;
      };
      if (!res.ok) throw new Error(body.error || "Sync failed");
      setSyncNote(
        (body.pulled ?? 0) === 0
          ? "Zeffy returned no upcoming events. Publish the events in Zeffy, then sync again."
          : `Zeffy events: ${body.pulled ?? 0}. Created ${body.created ?? 0}, updated ${body.updated ?? 0}, cancelled ${body.cancelled ?? 0}.`,
      );
      setLastSyncedAt(body.lastSyncedAt ?? null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function archiveCsv() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/zeffy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveCsv: true }),
      });
      const body = (await res.json()) as { error?: string; archived?: number };
      if (!res.ok) throw new Error(body.error || "Could not archive");
      setSyncNote(`Archived ${body.archived ?? 0} CSV-imported sessions.`);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive");
    } finally {
      setSyncing(false);
    }
  }

  const now = Date.now();

  return (
    <AdminShell
      title="Classes"
      description="Published sessions (upcoming and past). Create or edit sessions and manage rosters."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/admin/classes/new">New class</Link>
        </Button>
        <Button type="button" variant="outline" disabled={syncing} onClick={() => void syncNow()}>
          {syncing ? "Working…" : "Sync from Zeffy now"}
        </Button>
        <Button type="button" variant="outline" disabled={syncing} onClick={() => void archiveCsv()}>
          Archive CSV-imported sessions
        </Button>
      </div>
      {lastSyncedAt ? (
        <p className="mt-3 text-sm text-secondary">
          Last sync {formatDateTime(lastSyncedAt)}
        </p>
      ) : null}
      {syncNote ? (
        <p className="mt-3 text-sm text-brown">{syncNote}</p>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-brown" role="alert">
          {error}
        </p>
      ) : null}

      {classes === null ? (
        <p className="mt-10 text-secondary">Loading classes…</p>
      ) : classes.length === 0 ? (
        <p className="mt-10 text-secondary">No published classes yet.</p>
      ) : (
        <ul className="mt-10 divide-y divide-border border-y border-border">
          {classes.map((session) => {
            const past = new Date(session.startsAt).getTime() < now;
            const price =
              session.priceCents <= 0
                ? "Free"
                : formatMoney(session.priceCents);
            return (
              <li key={session.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/classes/${session.id}`}
                      className="font-display text-xl font-semibold text-brown hover:text-primary-text"
                    >
                      {session.title}
                    </Link>
                    <p className="mt-1 text-sm text-secondary">
                      {formatDateTime(session.startsAt)}
                      {session.location ? ` · ${session.location}` : ""}
                      {session.instructor?.displayName
                        ? ` · ${session.instructor.displayName}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="muted">
                      {CATEGORY_LABEL[session.category]}
                    </StatusPill>
                    <StatusPill tone={past ? "muted" : "ok"}>
                      {session.cancelledAt ? "Cancelled" : past ? "Past" : "Upcoming"}
                    </StatusPill>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal">
                  <span>{price}</span>
                  <span>
                    {session.bookedCount}/{session.capacity} booked
                    {session.waitlistCount > 0
                      ? ` · ${session.waitlistCount} waitlist`
                      : ""}
                  </span>
                </div>
                <p className="mt-3">
                  <Link
                    href={`/admin/classes/${session.id}`}
                    className="font-display text-sm font-semibold text-primary-text hover:underline"
                  >
                    Manage →
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
