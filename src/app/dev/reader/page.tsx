"use client";

import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { AuthorizeResult, Badge, Machine } from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const FAKE_PRINTER_SECONDS = 60;

type ReaderLogEntry = {
  id: string;
  at: string;
  machineName: string;
  badgeUid: string;
  result: AuthorizeResult;
};

export default function DevReaderPage() {
  const { provider, revision, bump } = useData();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [machineId, setMachineId] = useState("");
  const [badgeUid, setBadgeUid] = useState("");
  const [startTimer, setStartTimer] = useState(true);
  const [lastResult, setLastResult] = useState<AuthorizeResult | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeReaderKey, setActiveReaderKey] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [log, setLog] = useState<ReaderLogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      const [m, b] = await Promise.all([
        provider.listMachines(),
        provider.adminListBadges(),
      ]);
      setMachines(m.filter((x) => x.active));
      setBadges(b);
      if (!machineId && m[0]) setMachineId(m[0].id);
      if (!badgeUid && b[0]) setBadgeUid(b[0].uid);
    })();
  }, [provider, revision]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  }

  function beginFakePrinter(
    readerKey: string,
    sessionId: string,
    seconds = FAKE_PRINTER_SECONDS,
  ) {
    clearTimer();
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          void (async () => {
            try {
              await provider.endAccess({ readerKey, sessionId });
              bump();
              setActiveSessionId(null);
              setActiveReaderKey(null);
              setLog((entries) => [
                {
                  id: `end-${Date.now()}`,
                  at: new Date().toISOString(),
                  machineName: "FakePrinter",
                  badgeUid: "—",
                  result: {
                    allow: true,
                    reason: "ok",
                    sessionId,
                    reservationNotice: "Auto endAccess (timer hit 0)",
                  },
                },
                ...entries,
              ]);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Timer endAccess failed",
              );
            }
          })();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function onAuthorize() {
    const machine = machines.find((m) => m.id === machineId);
    if (!machine || !badgeUid) return;
    setPending(true);
    setError(null);
    try {
      const result = await provider.authorizeAccess({
        readerKey: machine.readerKey,
        badgeUid,
      });
      setLastResult(result);
      bump();
      setLog((entries) => [
        {
          id: `auth-${Date.now()}`,
          at: new Date().toISOString(),
          machineName: machine.name,
          badgeUid,
          result,
        },
        ...entries,
      ]);
      if (result.allow && result.sessionId) {
        setActiveSessionId(result.sessionId);
        setActiveReaderKey(machine.readerKey);
        if (startTimer) {
          beginFakePrinter(machine.readerKey, result.sessionId);
        } else {
          clearTimer();
        }
      } else {
        setActiveSessionId(null);
        setActiveReaderKey(null);
        clearTimer();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorize failed");
    } finally {
      setPending(false);
    }
  }

  async function onEndSession() {
    if (!activeSessionId || !activeReaderKey) return;
    setPending(true);
    setError(null);
    try {
      await provider.endAccess({
        readerKey: activeReaderKey,
        sessionId: activeSessionId,
      });
      clearTimer();
      setLog((entries) => [
        {
          id: `end-${Date.now()}`,
          at: new Date().toISOString(),
          machineName:
            machines.find((m) => m.readerKey === activeReaderKey)?.name ??
            activeReaderKey,
          badgeUid: "—",
          result: {
            allow: true,
            reason: "ok",
            sessionId: activeSessionId,
            reservationNotice: "Manual endAccess",
          },
        },
        ...entries,
      ]);
      setActiveSessionId(null);
      setActiveReaderKey(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "End session failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      eyebrow="Dev tools"
      title="Badge reader"
      description="Simulate machine authorize / endAccess with fixture badges."
    >
      {error ? (
        <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}

      <div className="grid max-w-xl gap-4">
        <div className="space-y-2">
          <Label htmlFor="machine">Machine</Label>
          <select
            id="machine"
            className={selectClass}
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.readerKey})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="badge">Badge</Label>
          <select
            id="badge"
            className={selectClass}
            value={badgeUid}
            onChange={(e) => setBadgeUid(e.target.value)}
          >
            {badges.map((b) => (
              <option key={b.id} value={b.uid}>
                {b.label ?? b.uid}
                {b.active ? "" : " (inactive)"}
                {!b.userId ? " · unlinked" : ""}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 font-display text-sm text-brown">
          <input
            type="checkbox"
            className="size-4"
            checked={startTimer}
            onChange={(e) => setStartTimer(e.target.checked)}
          />
          Start FakePrinter timer ({FAKE_PRINTER_SECONDS}s) on allow
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={pending || !machineId || !badgeUid}
            onClick={() => void onAuthorize()}
          >
            Authorize
          </Button>
          {activeSessionId ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void onEndSession()}
            >
              End session
            </Button>
          ) : null}
        </div>
      </div>

          {lastResult ? (
        <div className="mt-8 max-w-xl rounded-2xl border border-border bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={lastResult.allow ? "ok" : "danger"}>
              {lastResult.allow ? "Allow" : "Deny"}
            </StatusPill>
            <span className="font-display text-sm text-secondary">
              {lastResult.reason}
            </span>
          </div>
          {lastResult.reason === "reservation_required" ? (
            <p className="mt-2 text-sm text-secondary">
              This machine requires a booked reservation that covers now.
              Reserve a slot, then try again during that window.
            </p>
          ) : null}
          {lastResult.userDisplayName ? (
            <p className="mt-2 text-brown">{lastResult.userDisplayName}</p>
          ) : null}
          {lastResult.sessionId ? (
            <p className="mt-1 font-mono text-xs text-secondary">
              session {lastResult.sessionId}
            </p>
          ) : null}
          {lastResult.reservationNotice ? (
            <p className="mt-2 text-sm text-secondary">
              {lastResult.reservationNotice}
            </p>
          ) : null}
          {countdown != null ? (
            <p className="mt-3 font-display text-lg font-semibold text-brown">
              FakePrinter: {countdown}s
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Recent results
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {log.map((entry) => (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={entry.result.allow ? "ok" : "danger"}>
                  {entry.result.allow ? "Allow" : "Deny"}
                </StatusPill>
                <span className="text-sm text-secondary">
                  {formatDateTime(entry.at)} · {entry.machineName} ·{" "}
                  {entry.badgeUid}
                </span>
              </div>
              <p className="mt-1 text-sm text-charcoal">
                {entry.result.reason}
                {entry.result.userDisplayName
                  ? ` · ${entry.result.userDisplayName}`
                  : ""}
                {entry.result.sessionId
                  ? ` · session ${entry.result.sessionId}`
                  : ""}
              </p>
              {entry.result.reservationNotice ? (
                <p className="mt-1 text-sm text-secondary">
                  {entry.result.reservationNotice}
                </p>
              ) : null}
            </li>
          ))}
          {log.length === 0 ? (
            <li className="py-4 text-secondary">No reads yet.</li>
          ) : null}
        </ul>
      </section>
    </AdminShell>
  );
}
