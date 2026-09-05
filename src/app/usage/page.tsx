"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { formatDateTime, formatMonthKey, minutesBetween } from "@/lib/format";
import type { Machine, UsageSession, UsageTotal } from "@/lib/data";

export default function UsagePage() {
  return (
    <MemberGate>
      <UsageBody />
    </MemberGate>
  );
}

function UsageBody() {
  const { provider, currentUser, revision } = useData();
  const [month, setMonth] = useState(formatMonthKey());
  const [sessions, setSessions] = useState<UsageSession[]>([]);
  const [totals, setTotals] = useState<UsageTotal[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      setMachines(await provider.listMachines());
      setSessions(await provider.getUsage(currentUser.id));
      setTotals(await provider.getUsageTotals(currentUser.id, month));
    })();
  }, [currentUser, provider, revision, month]);

  const machineName = useMemo(() => {
    const map = Object.fromEntries(machines.map((m) => [m.id, m.name]));
    return (id: string) => map[id] ?? id;
  }, [machines]);

  const sorted = useMemo(
    () =>
      sessions
        .slice()
        .sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        ),
    [sessions],
  );

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    keys.add(formatMonthKey());
    for (const s of sessions) {
      keys.add(s.startedAt.slice(0, 7));
    }
    return [...keys].sort().reverse();
  }, [sessions]);

  if (!currentUser) return null;

  return (
    <PageShell>
      <PageHero
        eyebrow="Usage"
        title="Your machine time"
        description="Sessions logged when your badge authorizes a machine. Monthly totals help you see where you spend shop time."
      />

      <div className="mt-10 flex flex-wrap items-end gap-4">
        <label className="space-y-2">
          <span className="font-display text-sm font-medium text-brown">
            Month
          </span>
          <select
            className="flex h-11 min-w-[10rem] rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="mt-10">
        <p className="eyebrow">Monthly totals</p>
        {totals.length > 0 ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {totals.map((t) => (
              <li
                key={t.machineId}
                className="rounded-2xl border border-border bg-surface/80 px-5 py-4"
              >
                <p className="font-display font-semibold text-brown">
                  {t.machineName}
                </p>
                <p className="mt-1 text-secondary">
                  {t.sessionCount} session{t.sessionCount === 1 ? "" : "s"} ·{" "}
                  {t.totalMinutes} min
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">No sessions in this month.</p>
        )}
      </section>

      <section className="mt-14">
        <p className="eyebrow">History</p>
        {sorted.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {sorted.map((s) => {
              const mins = minutesBetween(s.startedAt, s.endedAt);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-display font-medium text-brown">
                      {machineName(s.machineId)}
                    </p>
                    <p className="text-sm text-secondary">
                      {formatDateTime(s.startedAt)}
                      {s.endedAt ? ` → ${formatDateTime(s.endedAt)}` : " · open"}
                    </p>
                  </div>
                  <p className="font-display text-sm text-secondary">
                    {s.endedAt ? `${mins} min` : "In progress"}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">No usage recorded yet.</p>
        )}
      </section>
    </PageShell>
  );
}
