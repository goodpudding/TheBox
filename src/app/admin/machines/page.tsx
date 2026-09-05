"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { MachineQr } from "@/components/machine-qr";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type {
  Certification,
  Machine,
  MachineArea,
  MachineInput,
  UsageSession,
  User,
} from "@/lib/data";

const AREA_ORDER: MachineArea[] = [
  "3d_printing",
  "laser",
  "woodshop",
  "textiles_vinyl",
  "sublimation",
];

const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
};

const selectClassName =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function equipmentUrl(machineId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/equipment/${machineId}`;
}

function emptyForm(): {
  id?: string;
  name: string;
  area: MachineArea;
  requiredCertificationIds: string[];
  readerKey: string;
  active: boolean;
  reservationRecommended: boolean;
  reservationRequired: boolean;
  locationLabel: string;
  gettingStartedVideoUrl: string;
} {
  return {
    name: "",
    area: "3d_printing",
    requiredCertificationIds: [],
    readerKey: "",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "",
    gettingStartedVideoUrl: "",
  };
}

export default function AdminMachinesPage() {
  const { provider, revision, bump } = useData();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [openSessions, setOpenSessions] = useState<UsageSession[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const now = new Date();
        const from = new Date(now);
        from.setFullYear(from.getFullYear() - 1);
        const to = new Date(now);
        to.setDate(to.getDate() + 1);

        const [m, c, mem, usage] = await Promise.all([
          provider.listMachines(),
          provider.listCertifications(),
          provider.adminListMembers(),
          provider.adminListUsage({
            from: from.toISOString(),
            to: to.toISOString(),
          }),
        ]);
        if (cancelled) return;
        setMachines(m);
        setCerts(c);
        setMembers(mem);
        setOpenSessions(usage.filter((s) => !s.endedAt));
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load machines");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const memberName = useMemo(() => {
    const map = new Map(members.map((u) => [u.id, u.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [members]);

  const machineName = useMemo(() => {
    const map = new Map(machines.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? id;
  }, [machines]);

  const grouped = useMemo(
    () =>
      AREA_ORDER.map((area) => ({
        area,
        label: AREA_LABEL[area],
        machines: machines
          .filter((m) => m.area === area)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })).filter((g) => g.machines.length > 0),
    [machines],
  );

  function toggleCert(id: string) {
    setForm((prev) => ({
      ...prev,
      requiredCertificationIds: prev.requiredCertificationIds.includes(id)
        ? prev.requiredCertificationIds.filter((x) => x !== id)
        : [...prev.requiredCertificationIds, id],
    }));
  }

  function startEdit(machine: Machine) {
    setForm({
      id: machine.id,
      name: machine.name,
      area: machine.area,
      requiredCertificationIds: [...machine.requiredCertificationIds],
      readerKey: machine.readerKey,
      active: machine.active,
      reservationRecommended: machine.reservationRecommended,
      reservationRequired: machine.reservationRequired,
      locationLabel: machine.locationLabel,
      gettingStartedVideoUrl: machine.gettingStartedVideoUrl ?? "",
    });
    setMessage(null);
    setError(null);
  }

  function startCreate() {
    setForm(emptyForm());
    setMessage(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const video = form.gettingStartedVideoUrl.trim();
      const payload: MachineInput = {
        id: form.id,
        name: form.name.trim(),
        area: form.area,
        requiredCertificationIds: form.requiredCertificationIds,
        readerKey: form.readerKey.trim(),
        active: form.active,
        reservationRecommended: form.reservationRecommended,
        reservationRequired: form.reservationRequired,
        locationLabel: form.locationLabel.trim(),
        gettingStartedVideoUrl: video.length > 0 ? video : null,
      };
      await provider.adminUpsertMachine(payload);
      setMessage(form.id ? "Machine updated." : "Machine created.");
      setForm(emptyForm());
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save machine");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Machines"
      description="Catalog by area, required certifications, and who’s on a machine right now."
    >
      <section>
        <h2 className="font-display text-xl font-semibold text-brown">
          Live view
        </h2>
        {openSessions.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">
            No open usage sessions.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {openSessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-display font-semibold text-brown">
                    {memberName(s.userId)}
                  </p>
                  <p className="text-sm text-secondary">
                    on {machineName(s.machineId)} · since{" "}
                    {formatDateTime(s.startedAt)}
                  </p>
                </div>
                <StatusPill tone="ok">In use</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-brown">
            {form.id ? "Edit machine" : "New machine"}
          </h2>
          {form.id ? (
            <Button type="button" variant="ghost" size="sm" onClick={startCreate}>
              Clear / new
            </Button>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="mt-5 max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area">Area</Label>
            <select
              id="area"
              className={selectClassName}
              value={form.area}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  area: e.target.value as MachineArea,
                }))
              }
            >
              {AREA_ORDER.map((area) => (
                <option key={area} value={area}>
                  {AREA_LABEL[area]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationLabel">Location</Label>
            <Input
              id="locationLabel"
              placeholder="Woodshop · Bay A"
              value={form.locationLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, locationLabel: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gettingStartedVideoUrl">
              Getting started video URL
            </Label>
            <Input
              id="gettingStartedVideoUrl"
              type="url"
              placeholder="https://..."
              value={form.gettingStartedVideoUrl}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  gettingStartedVideoUrl: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="readerKey">Reader key</Label>
            <Input
              id="readerKey"
              required
              value={form.readerKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, readerKey: e.target.value }))
              }
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="font-display text-sm font-medium text-brown">
              Required certifications
            </legend>
            <div className="space-y-2 rounded-2xl border border-border bg-surface/60 px-4 py-3">
              {certs.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 text-sm text-charcoal"
                >
                  <input
                    type="checkbox"
                    checked={form.requiredCertificationIds.includes(c.id)}
                    onChange={() => toggleCert(c.id)}
                    className="size-4 accent-brown"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
              className="size-4 accent-brown"
            />
            Active
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.reservationRecommended}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reservationRecommended: e.target.checked,
                }))
              }
              className="size-4 accent-brown"
            />
            Reservation recommended
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.reservationRequired}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reservationRequired: e.target.checked,
                }))
              }
              className="size-4 accent-brown"
            />
            Reservation required to start
          </label>

          {form.id ? (
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <p className="font-display text-sm font-medium text-brown">
                Equipment QR
              </p>
              <p className="mt-1 break-all text-sm text-secondary">
                {equipmentUrl(form.id)}
              </p>
              <div className="mt-4">
                <MachineQr
                  url={equipmentUrl(form.id)}
                  label={form.name || "Equipment"}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-brown" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-secondary">{message}</p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : form.id ? "Save machine" : "Create machine"}
          </Button>
        </form>
      </section>

      <section className="mt-14 space-y-10">
        <h2 className="font-display text-xl font-semibold text-brown">
          Catalog
        </h2>
        {grouped.length === 0 ? (
          <p className="text-secondary">No machines yet.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.area}>
              <h3 className="font-display text-lg font-semibold text-brown">
                {group.label}
              </h3>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {group.machines.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="font-display font-semibold text-brown">
                        {m.name}
                      </p>
                      <p className="mt-1 text-sm text-secondary">
                        {m.locationLabel ? `${m.locationLabel} · ` : ""}
                        Reader: {m.readerKey}
                        {m.requiredCertificationIds.length > 0
                          ? ` · ${m.requiredCertificationIds.length} cert${m.requiredCertificationIds.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill tone={m.active ? "ok" : "muted"}>
                          {m.active ? "Active" : "Inactive"}
                        </StatusPill>
                        {m.reservationRequired ? (
                          <StatusPill tone="warn">Reserve required</StatusPill>
                        ) : m.reservationRecommended ? (
                          <StatusPill tone="info">
                            Reserve recommended
                          </StatusPill>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(m)}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </AdminShell>
  );
}
