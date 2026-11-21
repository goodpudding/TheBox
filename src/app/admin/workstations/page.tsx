"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminNotice } from "@/components/admin/admin-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { formatDateTime } from "@/lib/format";
import { readJson } from "@/lib/read-json";
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
    gramRateCents: number;
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

type DeskDraft = {
  id?: string;
  name: string;
  deviceId: string;
  location: string;
  billedMachineId: string;
  idleLockMinutes: string;
  idleLogoutMinutes: string;
  active: boolean;
};

type MapDraft = {
  id?: string;
  displayName: string;
  exeName: string;
  exePath: string;
  machineId: string;
  workstationId: string;
  sortOrder: string;
  active: boolean;
};

const blankDesk = (machineId = ""): DeskDraft => ({
  name: "",
  deviceId: "",
  location: "",
  billedMachineId: machineId,
  idleLockMinutes: "10",
  idleLogoutMinutes: "30",
  active: true,
});

const blankMap = (): MapDraft => ({
  displayName: "",
  exeName: "",
  exePath: "",
  machineId: "",
  workstationId: "",
  sortOrder: "0",
  active: true,
});

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm";

export default function AdminWorkstationsPage() {
  const { currentUser, provider, revision } = useData();
  const [rows, setRows] = useState<Row[]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [desk, setDesk] = useState<DeskDraft>(blankDesk());
  const [map, setMap] = useState<MapDraft>(blankMap());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(currentUser ? { "x-box-user-id": currentUser.id } : {}),
    };
  }

  /** Reads the three lists. One the server refused comes back as null. */
  async function fetchLists() {
    const [ws, sm, m] = await Promise.all([
      fetch("/api/admin/workstations", { headers: headers() }),
      fetch("/api/admin/software-maps", { headers: headers() }),
      provider.adminListMachines(),
    ]);
    const desks = await readJson<{ workstations: Row[] }>(ws);
    const mapList = await readJson<{ maps: MapRow[] }>(sm);
    return {
      rows: ws.ok && desks ? desks.workstations : null,
      maps: sm.ok && mapList ? mapList.maps : null,
      machines: m,
    };
  }

  function showLists(lists: Awaited<ReturnType<typeof fetchLists>>) {
    if (lists.rows) setRows(lists.rows);
    if (lists.maps) setMaps(lists.maps);
    setMachines(lists.machines);
  }

  async function load() {
    showLists(await fetchLists());
  }

  useEffect(() => {
    let cancelled = false;
    void fetchLists().then((lists) => {
      if (!cancelled) showLists(lists);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, revision]);

  const machineName = (id: string | null) =>
    id ? (machines.find((m) => m.id === id)?.name ?? id) : null;
  const deskName = (id: string | null) =>
    id ? (rows.find((w) => w.id === id)?.name ?? id) : null;

  /** POSTs JSON and reports the outcome. True when the server saved it. */
  async function save(url: string, payload: unknown, done: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const body = await readJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(body?.error ?? "Could not save. Please try again.");
        return false;
      }
      setMessage(done);
      await load();
      return true;
    } catch {
      setError("Could not save. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function onSaveDesk(e: FormEvent) {
    e.preventDefault();
    const ok = await save(
      "/api/admin/workstations",
      {
        id: desk.id,
        name: desk.name.trim(),
        deviceId: desk.deviceId.trim(),
        location: desk.location.trim(),
        billedMachineId: desk.billedMachineId || machines[0]?.id || "",
        idleLockMinutes: Number(desk.idleLockMinutes) || 10,
        idleLogoutMinutes: Number(desk.idleLogoutMinutes) || 30,
        active: desk.active,
      },
      desk.id ? "Workstation updated." : "Workstation registered.",
    );
    if (ok) setDesk(blankDesk());
  }

  async function onSaveMap(e: FormEvent) {
    e.preventDefault();
    const ok = await save(
      "/api/admin/software-maps",
      {
        id: map.id,
        displayName: map.displayName.trim(),
        exeName: map.exeName.trim(),
        exePath: map.exePath.trim() || null,
        machineId: map.machineId || null,
        workstationId: map.workstationId || null,
        sortOrder: Number(map.sortOrder) || 0,
        active: map.active,
      },
      map.id ? "Software updated." : "Software added.",
    );
    if (ok) setMap(blankMap());
  }

  function editDesk(w: Row) {
    setDesk({
      id: w.id,
      name: w.name,
      deviceId: w.deviceId,
      location: w.location,
      billedMachineId: w.billedMachineId,
      idleLockMinutes: String(w.idleLockMinutes),
      idleLogoutMinutes: String(w.idleLogoutMinutes),
      active: w.active,
    });
    setMessage(null);
    setError(null);
    document.getElementById("desk-form")?.scrollIntoView();
  }

  function editMap(m: MapRow) {
    setMap({
      id: m.id,
      displayName: m.displayName,
      exeName: m.exeName,
      exePath: m.exePath ?? "",
      machineId: m.machineId ?? "",
      workstationId: m.workstationId ?? "",
      sortOrder: String(m.sortOrder),
      active: m.active,
    });
    setMessage(null);
    setError(null);
    document.getElementById("map-form")?.scrollIntoView();
  }

  return (
    <AdminShell
      title="Workstations"
      description="Shared Windows PCs. Login is identity and which software they may open — it does not bill desk time. No ESP32 on these computers."
    >
      <AdminNotice message={message} error={error} />

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
              <div className="flex flex-wrap items-center gap-2">
                {w.active ? null : <StatusPill tone="danger">Switched off</StatusPill>}
                <StatusPill tone={w.openSession ? "ok" : "muted"}>
                  {w.openSession
                    ? `${w.openSession.displayName} since ${formatDateTime(w.openSession.startedAt)}`
                    : "Idle"}
                </StatusPill>
              </div>
            </div>
            <p className="mt-1 text-sm text-secondary">
              {w.deviceId} · {w.location} · primary {w.billedMachineName} (
              {w.billing.mode === "hourly_job"
                ? `${formatMoneyExact(w.billing.hourlyRateCents)}/hr of job time`
                : w.billing.mode === "per_gram"
                  ? `filament by the gram, ${w.billing.gramRateCents.toFixed(2)}¢/g`
                  : w.billing.mode}
              )
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              aria-label={`Edit ${w.name}`}
              onClick={() => editDesk(w)}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="text-secondary">No PCs registered yet.</p>
      ) : null}

      <form
        id="desk-form"
        onSubmit={(e) => void onSaveDesk(e)}
        className="mt-10 grid max-w-xl gap-4 scroll-mt-24"
      >
        <h2 className="font-display text-xl font-semibold text-brown">
          {desk.id ? `Edit ${desk.name || "this PC"}` : "Register a PC"}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            placeholder="Design PC 2"
            value={desk.name}
            onChange={(e) => setDesk({ ...desk, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deviceId">Windows device id</Label>
          <Input
            id="deviceId"
            required
            placeholder="BOX-PC-3"
            value={desk.deviceId}
            onChange={(e) => setDesk({ ...desk, deviceId: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="3D lab"
            value={desk.location}
            onChange={(e) => setDesk({ ...desk, location: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billedMachineId">Primary machine at this desk</Label>
          <select
            id="billedMachineId"
            required
            className={selectClass}
            value={desk.billedMachineId || machines[0]?.id || ""}
            onChange={(e) => setDesk({ ...desk, billedMachineId: e.target.value })}
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.active ? "" : " (switched off)"}
              </option>
            ))}
          </select>
          {machines.length === 0 ? (
            <p className="text-sm text-secondary">
              Add the machine under Admin → Machines first.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="idleLockMinutes">Lock minutes</Label>
            <Input
              id="idleLockMinutes"
              type="number"
              value={desk.idleLockMinutes}
              onChange={(e) => setDesk({ ...desk, idleLockMinutes: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="idleLogoutMinutes">Logout minutes</Label>
            <Input
              id="idleLogoutMinutes"
              type="number"
              value={desk.idleLogoutMinutes}
              onChange={(e) =>
                setDesk({ ...desk, idleLogoutMinutes: e.target.value })
              }
            />
          </div>
        </div>
        <label className="flex items-center gap-3 text-charcoal">
          <input
            type="checkbox"
            className="size-5"
            checked={desk.active}
            onChange={(e) => setDesk({ ...desk, active: e.target.checked })}
          />
          In use (untick to retire this PC; nobody can sign in at it)
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || machines.length === 0}>
            {pending ? "Saving…" : "Save workstation"}
          </Button>
          {desk.id ? (
            <Button type="button" variant="outline" onClick={() => setDesk(blankDesk())}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <h2 className="mt-14 font-display text-xl font-semibold text-brown">
        Software on the PCs
      </h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {maps.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <div className="min-w-0">
              <span className="font-display font-medium text-brown">
                {m.displayName}
              </span>
              <span className="text-secondary"> · {m.exeName}</span>{" "}
              {m.active ? null : <StatusPill tone="muted">Switched off</StatusPill>}
              <span className="block text-xs text-secondary">
                {machineName(m.machineId) ?? "Any machine"} ·{" "}
                {deskName(m.workstationId) ?? "every PC"}
                {m.exePath ? ` · ${m.exePath}` : ""}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Edit ${m.displayName}`}
              onClick={() => editMap(m)}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>

      <form
        id="map-form"
        onSubmit={(e) => void onSaveMap(e)}
        className="mt-8 grid max-w-xl gap-4 scroll-mt-24"
      >
        <h3 className="font-display text-lg font-semibold text-brown">
          {map.id ? `Edit ${map.displayName || "this program"}` : "Add a program"}
        </h3>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            required
            value={map.displayName}
            onChange={(e) => setMap({ ...map, displayName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exeName">Exe name</Label>
          <Input
            id="exeName"
            required
            placeholder="bambu-studio.exe"
            value={map.exeName}
            onChange={(e) => setMap({ ...map, exeName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exePath">Full path (optional)</Label>
          <Input
            id="exePath"
            value={map.exePath}
            onChange={(e) => setMap({ ...map, exePath: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="machineId">Goes with machine</Label>
          <select
            id="machineId"
            className={selectClass}
            value={map.machineId}
            onChange={(e) => setMap({ ...map, machineId: e.target.value })}
          >
            <option value="">Any machine (general software)</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workstationId">On which PC</Label>
          <select
            id="workstationId"
            className={selectClass}
            value={map.workstationId}
            onChange={(e) => setMap({ ...map, workstationId: e.target.value })}
          >
            <option value="">Every PC</option>
            {rows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Order</Label>
          <Input
            id="sortOrder"
            type="number"
            value={map.sortOrder}
            onChange={(e) => setMap({ ...map, sortOrder: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-3 text-charcoal">
          <input
            type="checkbox"
            className="size-5"
            checked={map.active}
            onChange={(e) => setMap({ ...map, active: e.target.checked })}
          />
          Show on the PCs
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save program"}
          </Button>
          {map.id ? (
            <Button type="button" variant="outline" onClick={() => setMap(blankMap())}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </AdminShell>
  );
}
