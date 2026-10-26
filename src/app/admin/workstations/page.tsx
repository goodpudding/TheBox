"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { formatDateTime } from "@/lib/format";
import { formatMoneyExact } from "@/lib/utils";
import type { Machine } from "@/lib/data";

type Row = {
  id: string;
  name: string;
  deviceId: string;
  location: string;
  active: boolean;
  billedMachineId: string;
  billedMachineName: string;
  billing: {
    mode: string;
    hourlyRateCents: number;
    setupFeeCents: number;
  };
  idleLockMinutes: number;
  idleLogoutMinutes: number;
  lastSeenAt: string | null;
  openSession: {
    id: string;
    displayName: string;
    startedAt: string;
  } | null;
};

type MapRow = {
  id: string;
  machineId: string | null;
  workstationId: string | null;
  displayName: string;
  exeName: string;
  exePath: string | null;
  sortOrder: number;
  active: boolean;
};

export default function AdminWorkstationsPage() {
  const { currentUser, provider, revision } = useData();
  const [rows, setRows] = useState<Row[]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(currentUser ? { "x-box-user-id": currentUser.id } : {}),
    };
  }

  async function load() {
    const [ws, sm, m] = await Promise.all([
      fetch("/api/admin/workstations", { headers: headers() }),
      fetch("/api/admin/software-maps", { headers: headers() }),
      provider.listMachines(),
    ]);
    if (ws.ok) {
      const body = (await ws.json()) as { workstations: Row[] };
      setRows(body.workstations);
    }
    if (sm.ok) {
      const body = (await sm.json()) as { maps: MapRow[] };
      setMaps(body.maps);
    }
    setMachines(m);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, revision]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/workstations", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        id: String(form.get("id") || "") || undefined,
        name: String(form.get("name") ?? "").trim(),
        deviceId: String(form.get("deviceId") ?? "").trim(),
        location: String(form.get("location") ?? "").trim(),
        billedMachineId: String(form.get("billedMachineId") ?? "").trim(),
        idleLockMinutes: Number(form.get("idleLockMinutes") || 10),
        idleLogoutMinutes: Number(form.get("idleLogoutMinutes") || 30),
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not save");
      return;
    }
    setMessage("Workstation saved.");
    await load();
  }

  async function onSaveMap(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/software-maps", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        id: String(form.get("id") || "") || undefined,
        displayName: String(form.get("displayName") ?? "").trim(),
        exeName: String(form.get("exeName") ?? "").trim(),
        exePath: String(form.get("exePath") ?? "").trim() || null,
        machineId: String(form.get("machineId") ?? "").trim() || null,
        workstationId: String(form.get("workstationId") ?? "").trim() || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not save map");
      return;
    }
    setMessage("Software map saved.");
    await load();
  }

  return (
    <AdminShell
      title="Workstations"
      description="Shared Windows PCs. Login starts a billed session at the desk’s machine rate. No ESP32 on these computers."
    >
      {error ? <p className="mb-4 text-accent">{error}</p> : null}
      {message ? <p className="mb-4 text-brown">{message}</p> : null}

      <ul className="space-y-3">
        {rows.map((w) => (
          <li
            key={w.id}
            className="rounded-2xl border border-border bg-surface px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-brown">
                {w.name}
              </h2>
              <StatusPill tone={w.openSession ? "ok" : "muted"}>
                {w.openSession
                  ? `${w.openSession.displayName} since ${formatDateTime(w.openSession.startedAt)}`
                  : "Idle"}
              </StatusPill>
            </div>
            <p className="mt-1 text-sm text-secondary">
              {w.deviceId} · {w.location} · bills {w.billedMachineName} (
              {w.billing.mode === "hourly"
                ? `${formatMoneyExact(w.billing.hourlyRateCents)}/hr`
                : w.billing.mode}
              )
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={onSave} className="mt-10 grid gap-4 max-w-xl">
        <h2 className="font-display text-xl font-semibold text-brown">
          Register or update a PC
        </h2>
        <div className="space-y-2">
          <Label htmlFor="id">Id (optional)</Label>
          <Input id="id" name="id" placeholder="ws-pc-3" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Design PC 2" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deviceId">Windows device id</Label>
          <Input id="deviceId" name="deviceId" required placeholder="BOX-PC-3" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="3D lab" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billedMachineId">Billed machine</Label>
          <select
            id="billedMachineId"
            name="billedMachineId"
            required
            className="flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="idleLockMinutes">Lock minutes</Label>
            <Input
              id="idleLockMinutes"
              name="idleLockMinutes"
              type="number"
              defaultValue={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="idleLogoutMinutes">Logout minutes</Label>
            <Input
              id="idleLogoutMinutes"
              name="idleLogoutMinutes"
              type="number"
              defaultValue={30}
            />
          </div>
        </div>
        <Button type="submit">Save workstation</Button>
      </form>

      <h2 className="mt-14 font-display text-xl font-semibold text-brown">
        Software maps
      </h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {maps.map((m) => (
          <li key={m.id} className="py-3 text-sm">
            <span className="font-display font-medium text-brown">
              {m.displayName}
            </span>
            <span className="text-secondary"> · {m.exeName}</span>
            {m.exePath ? (
              <span className="block text-xs text-secondary">{m.exePath}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <form onSubmit={onSaveMap} className="mt-8 grid gap-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exeName">Exe name</Label>
          <Input id="exeName" name="exeName" required placeholder="bambu-studio.exe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exePath">Full path (optional)</Label>
          <Input id="exePath" name="exePath" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="machineId">Machine id (blank = general)</Label>
          <Input id="machineId" name="machineId" placeholder="m-bambu-a1" />
        </div>
        <Button type="submit">Save software map</Button>
      </form>
    </AdminShell>
  );
}
