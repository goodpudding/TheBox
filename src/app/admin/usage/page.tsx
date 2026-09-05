"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { AccessLog, Machine, UsageSession, User } from "@/lib/data";

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function toRange(fromDate: string, toDate: string) {
  return {
    from: `${fromDate}T00:00:00.000Z`,
    to: `${toDate}T23:59:59.999Z`,
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsagePage() {
  const { provider, revision } = useData();
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [userId, setUserId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [sessions, setSessions] = useState<UsageSession[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [members]);

  const machineName = useMemo(() => {
    const map = new Map(machines.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? id;
  }, [machines]);

  useEffect(() => {
    void (async () => {
      const [m, mac] = await Promise.all([
        provider.adminListMembers(),
        provider.listMachines(),
      ]);
      setMembers(m);
      setMachines(mac);
    })();
  }, [provider, revision]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const range = toRange(fromDate, toDate);
      const [usage, access] = await Promise.all([
        provider.adminListUsage(range, {
          userId: userId || undefined,
          machineId: machineId || undefined,
        }),
        provider.adminListAccessLogs(range),
      ]);
      setSessions(usage);
      setLogs(
        access.filter((l) => {
          if (userId && l.userId !== userId) return false;
          if (machineId && l.machineId !== machineId) return false;
          return true;
        }),
      );
      setLoading(false);
    })();
  }, [provider, revision, fromDate, toDate, userId, machineId]);

  function exportCsv() {
    const rows: string[][] = [
      [
        "sessionId",
        "userId",
        "userName",
        "machineId",
        "machineName",
        "badgeId",
        "startedAt",
        "endedAt",
        "endedBy",
        "reservationId",
      ],
      ...sessions.map((s) => [
        s.id,
        s.userId,
        memberName(s.userId),
        s.machineId,
        machineName(s.machineId),
        s.badgeId,
        s.startedAt,
        s.endedAt ?? "",
        s.endedBy,
        s.reservationId ?? "",
      ]),
    ];
    downloadCsv(`usage-${fromDate}-to-${toDate}.csv`, rows);
  }

  return (
    <AdminShell
      title="Usage & access"
      description="Session history and badge authorize allow/deny logs."
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userId">User (optional)</Label>
          <Input
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user id"
            className="w-56"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="machineId">Machine (optional)</Label>
          <Input
            id="machineId"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            placeholder="machine id"
            className="w-56"
          />
        </div>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          Export usage CSV
        </Button>
      </div>

      {loading ? (
        <p className="mt-10 text-secondary">Loading…</p>
      ) : (
        <>
          <section className="mt-12">
            <h2 className="font-display text-xl font-semibold text-brown">
              Sessions ({sessions.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border font-display text-secondary">
                    <th className="py-2 pr-3 font-medium">Started</th>
                    <th className="py-2 pr-3 font-medium">Member</th>
                    <th className="py-2 pr-3 font-medium">Machine</th>
                    <th className="py-2 pr-3 font-medium">Ended</th>
                    <th className="py-2 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-border/70">
                      <td className="py-2.5 pr-3 text-charcoal">
                        {formatDateTime(s.startedAt)}
                      </td>
                      <td className="py-2.5 pr-3">{memberName(s.userId)}</td>
                      <td className="py-2.5 pr-3">
                        {machineName(s.machineId)}
                      </td>
                      <td className="py-2.5 pr-3 text-secondary">
                        {s.endedAt ? formatDateTime(s.endedAt) : "open"}
                      </td>
                      <td className="py-2.5">{s.endedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sessions.length === 0 ? (
                <p className="mt-4 text-secondary">No sessions in range.</p>
              ) : null}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="font-display text-xl font-semibold text-brown">
              Access logs ({logs.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border font-display text-secondary">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Result</th>
                    <th className="py-2 pr-3 font-medium">Badge</th>
                    <th className="py-2 pr-3 font-medium">Reader</th>
                    <th className="py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-border/70">
                      <td className="py-2.5 pr-3">
                        {formatDateTime(l.requestedAt)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusPill tone={l.allow ? "ok" : "danger"}>
                          {l.allow ? "Allow" : "Deny"}
                        </StatusPill>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs">
                        {l.badgeUid}
                      </td>
                      <td className="py-2.5 pr-3">{l.readerKey}</td>
                      <td className="py-2.5 text-secondary">
                        {l.reason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 ? (
                <p className="mt-4 text-secondary">No access logs in range.</p>
              ) : null}
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
