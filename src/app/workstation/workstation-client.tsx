"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";
import { formatMoneyExact, formatTier } from "@/lib/utils";
import { quoteMachineJob } from "@/lib/credits";
import type { MachineArea, MembershipTier } from "@/lib/data/types";
import { isTauriShell, nativeInvoke } from "@/lib/workstation/native";

type Billing = {
  machineId: string;
  machineName: string;
  area: string;
  mode: "hourly_job" | "per_gram" | "per_print" | "free";
  hourlyRateCents: number;
  setupFeeCents: number;
  sessionUnit: "print" | "gram" | null;
  gramRateCents: number;
  deskLoginBills: false;
  hint: string;
};

type Job = {
  id: string;
  machineId: string;
  machineName: string;
  filamentGrams: number | null;
  billedCents: number | null;
  billed: boolean;
  note: string | null;
  completedAt: string | null;
  status?: string;
  unlimited?: boolean;
};

type Me = {
  user: {
    id: string;
    email: string;
    firstName: string;
    displayName: string;
    status: string;
    tier: string | null;
    shopAccess: boolean;
    role: string;
  };
  waiverCurrent: boolean;
  certifications: {
    id: string;
    name: string;
    status: string;
    expiresAt: string | null;
  }[];
  creditBalanceCents: number;
  reservations: {
    id: string;
    machineId: string;
    machineName: string;
    startsAt: string;
    endsAt: string;
  }[];
  jobs: Job[];
  session: {
    id: string;
    workstationName: string;
    deviceId: string;
    location: string;
    startedAt: string;
    idleLockMinutes: number;
    idleLogoutMinutes: number;
    billing: Billing;
  };
  mustChangePin?: boolean;
};

type Config = {
  workstation: {
    id: string;
    name: string;
    deviceId: string;
    location: string;
    idleLockMinutes: number;
    idleLogoutMinutes: number;
    billing: Billing;
  };
  equipment: {
    machineId: string;
    name: string;
    area: string;
    areaLabel: string;
    locationLabel: string;
    reservationRequired: boolean;
    requiredCertificationIds: string[];
    software: {
      id: string;
      displayName: string;
      exeName: string;
      exePath: string | null;
    } | null;
  }[];
  generalSoftware: {
    id: string;
    displayName: string;
    exeName: string;
    exePath: string | null;
  }[];
};

const TOKEN_KEY = "thebox_workstation_token";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

function writeStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = readStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers, cache: "no-store" });
}

async function nativeStoreToken(token: string) {
  await nativeInvoke("store_session_token", { token });
}

async function nativeClear() {
  await nativeInvoke("clear_session_token");
  await nativeInvoke("clear_webview_data");
}

export function WorkstationClient() {
  const params = useSearchParams();
  const device = params.get("device") || "BOX-PC-1";
  const [config, setConfig] = useState<Config | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"pin" | "qr">("pin");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qr, setQr] = useState<{
    challengeId: string;
    userCode: string;
    qrDataUrl: string;
    expiresAt: string;
  } | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockPin, setLockPin] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [mustChangePin, setMustChangePin] = useState(false);
  const [nextPin, setNextPin] = useState("");
  const [confirmNextPin, setConfirmNextPin] = useState("");
  const [now, setNow] = useState(Date.now());
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [launchNote, setLaunchNote] = useState<string | null>(null);
  const [grams, setGrams] = useState("");
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [prints, setPrints] = useState("1");
  const [jobMachineId, setJobMachineId] = useState("");
  const [jobPending, setJobPending] = useState(false);

  const refreshMe = useCallback(async () => {
    const res = await apiFetch("/api/me");
    if (!res.ok) {
      setMe(null);
      return null;
    }
    const body = (await res.json()) as Me;
    setMe(body);
    setMustChangePin(Boolean(body.mustChangePin));
    return body;
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await nativeInvoke<string>("get_session_token");
      if (stored) writeStoredToken(stored);
      const cfg = await fetch(`/api/workstations/${encodeURIComponent(device)}/config`);
      if (cfg.ok) setConfig((await cfg.json()) as Config);
      await refreshMe();
    })();
  }, [device, refreshMe]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const bump = () => setLastActivity(Date.now());
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);

  const logout = useCallback(async (endedBy: "logout" | "idle" = "logout") => {
    await apiFetch("/api/workstation/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endedBy }),
    });
    writeStoredToken(null);
    await nativeClear();
    setMe(null);
    setLocked(false);
    setMustChangePin(false);
    setLaunchNote(null);
  }, []);

  useEffect(() => {
    if (!me || mustChangePin) return;
    const idleMs = Date.now() - lastActivity;
    const lockMs = me.session.idleLockMinutes * 60_000;
    const logoutMs = me.session.idleLogoutMinutes * 60_000;
    if (idleMs >= logoutMs) {
      void logout("idle");
    } else if (idleMs >= lockMs) {
      setLocked(true);
    }
  }, [now, lastActivity, me, logout, mustChangePin]);

  useEffect(() => {
    if (!qr || me) return;
    const id = window.setInterval(async () => {
      const res = await fetch(
        `/api/workstation/qr/status?challengeId=${encodeURIComponent(qr.challengeId)}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as { status: string; token?: string; me?: Me };
      if (body.status === "approved" && body.me) {
        if (body.token) {
          writeStoredToken(body.token);
          await nativeStoreToken(body.token);
        }
        setMe(body.me);
        setLastActivity(Date.now());
        setQr(null);
      }
      if (body.status === "expired") setQr(null);
    }, 1500);
    return () => window.clearInterval(id);
  }, [qr, me]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/workstation/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workstationId: config?.workstation.id ?? device,
          email,
          pin,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        token?: string;
        me?: Me;
        mustChangePin?: boolean;
      };
      if (!res.ok) throw new Error(body.error ?? "Could not sign in");
      if (body.token) {
        writeStoredToken(body.token);
        await nativeStoreToken(body.token);
      }
      setMe(body.me ?? null);
      setMustChangePin(
        Boolean(body.mustChangePin || body.me?.mustChangePin),
      );
      setLastActivity(Date.now());
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  async function startQr() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/workstation/qr/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workstationId: config?.workstation.id ?? device,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start QR login");
      setQr(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start QR login");
    } finally {
      setPending(false);
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setLockError(null);
    try {
      const res = await apiFetch("/api/workstation/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: lockPin }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setLockError(body.error ?? "PIN didn't match");
        return;
      }
      setLocked(false);
      setLockPin("");
      setLastActivity(Date.now());
    } catch (err) {
      setLockError(err instanceof Error ? err.message : "PIN didn't match");
    }
  }

  async function chooseNewPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nextPin !== confirmNextPin) {
      setError("PINs don't match.");
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch("/api/workstation/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: nextPin }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save PIN");
      setMustChangePin(false);
      setNextPin("");
      setConfirmNextPin("");
      setLastActivity(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save PIN");
    } finally {
      setPending(false);
    }
  }

  async function launch(softwareMapId: string, machineId: string | null) {
    setLaunchNote(null);
    const res = await apiFetch("/api/workstation/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ softwareMapId, machineId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setLaunchNote(body.error ?? body.reason ?? "Launch blocked");
      return;
    }
    const path = body.launch?.exePath || body.launch?.exeName;
    const launched = await nativeInvoke("launch_executable", { path });
    if (launched == null && !isTauriShell()) {
      setLaunchNote(
        `Recorded ${body.launch?.displayName}. On the shop PC this opens ${path}. Prints keep running after logout.`,
      );
    } else {
      setLaunchNote(`Opened ${body.launch?.displayName}.`);
    }
  }

  async function sendJob(e: React.FormEvent) {
    e.preventDefault();
    const machineId =
      jobMachineId ||
      printers[0]?.machineId ||
      billing?.machineId ||
      "";
    if (!machineId) {
      setLaunchNote("Pick a machine.");
      return;
    }
    const filamentGrams = Number(grams);
    const minutes = Number(runtimeMinutes);
    const printCount = Number(prints);
    const payload: Record<string, unknown> = { machineId };
    if (Number.isFinite(filamentGrams) && filamentGrams > 0) {
      payload.filamentGrams = filamentGrams;
    }
    if (Number.isFinite(minutes) && minutes > 0) {
      payload.runtimeSeconds = Math.round(minutes * 60);
    }
    if (Number.isFinite(printCount) && printCount > 0) {
      payload.prints = printCount;
    }
    setJobPending(true);
    setLaunchNote(null);
    try {
      const res = await apiFetch("/api/workstation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        error?: string;
        job?: Job & { unlimited?: boolean };
        me?: Me;
      };
      if (!res.ok) throw new Error(body.error ?? "Could not send job");
      if (body.me) setMe(body.me);
      setGrams("");
      setRuntimeMinutes("");
      const job = body.job;
      if (job) {
        const charged =
          job.billedCents && job.billedCents > 0
            ? formatMoneyExact(job.billedCents)
            : job.unlimited
              ? "$0 (Unlimited)"
              : formatMoneyExact(0);
        setLaunchNote(
          `Sent ${job.machineName}. Charged ${charged} from machine credits. Sitting at the desk is not extra.`,
        );
      }
    } catch (err) {
      setLaunchNote(err instanceof Error ? err.message : "Could not send job");
    } finally {
      setJobPending(false);
    }
  }

  const billing = me?.session.billing ?? config?.workstation.billing;
  const printers = useMemo(
    () => (config?.equipment ?? []).filter((eq) => eq.area === "3d_printing"),
    [config],
  );
  const jobMachine =
    (config?.equipment ?? []).find(
      (eq) =>
        eq.machineId ===
        (jobMachineId ||
          (billing?.mode === "per_gram" ? printers[0]?.machineId : undefined) ||
          billing?.machineId),
    ) ?? null;
  const jobQuote =
    me && jobMachine
      ? quoteMachineJob({
          machine: {
            id: jobMachine.machineId,
            name: jobMachine.name,
            area: jobMachine.area as MachineArea,
          },
          payer: {
            tier: me.user.tier as MembershipTier | null,
            shopAccess: me.user.shopAccess,
            status: me.user.status,
          },
          filamentGrams: Number(grams) || null,
          runtimeSeconds: Number(runtimeMinutes)
            ? Number(runtimeMinutes) * 60
            : null,
          prints: Number(prints) || null,
        })
      : null;

  const certSet = useMemo(() => {
    const ids = new Set(
      (me?.certifications ?? [])
        .filter((c) => c.status === "certified")
        .map((c) => c.id),
    );
    return ids;
  }, [me]);

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-6">
        <p className="text-secondary">Loading {device}…</p>
      </div>
    );
  }

  if (me && mustChangePin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-6">
        <form
          onSubmit={(e) => void chooseNewPin(e)}
          className="w-full max-w-md"
        >
          <p className="eyebrow">Shop PIN</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-brown">
            Choose a new PIN
          </h1>
          <p className="mt-3 text-secondary">
            This temporary PIN works until you pick your own. 4–6 digits.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="next-pin">New PIN</Label>
            <Input
              id="next-pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              autoComplete="off"
              required
              value={nextPin}
              onChange={(e) => setNextPin(e.target.value)}
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="next-pin-confirm">Confirm PIN</Label>
            <Input
              id="next-pin-confirm"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              autoComplete="off"
              required
              value={confirmNextPin}
              onChange={(e) => setConfirmNextPin(e.target.value)}
            />
          </div>
          {error ? (
            <p className="mt-4 text-sm text-accent" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save PIN"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-charcoal">
      {locked && me ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-brown/90 px-6">
          <form
            onSubmit={unlock}
            className="w-full max-w-md rounded-[2rem] bg-page p-8"
          >
            <p className="eyebrow">Idle lock</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-brown">
              {me.user.firstName} is still signed in
            </h1>
            <p className="mt-3 text-secondary">
              Enter your PIN to keep working. Sitting here is not a charge.
            </p>
            <Label htmlFor="lock-pin" className="mt-6 block">
              PIN
            </Label>
            <Input
              id="lock-pin"
              className="mt-2"
              inputMode="numeric"
              autoComplete="off"
              type="password"
              value={lockPin}
              onChange={(e) => setLockPin(e.target.value)}
            />
            {lockError ? (
              <p className="mt-3 text-sm text-accent" role="alert">
                {lockError}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button type="submit">Unlock</Button>
              <Button type="button" variant="outline" onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <BrandMark href="/workstation" compact />
        <div className="text-right">
          <p className="font-display text-sm font-semibold text-brown">
            {config.workstation.name}
          </p>
          <p className="text-xs text-secondary">
            {config.workstation.location} · {config.workstation.deviceId}
          </p>
        </div>
      </header>

      {!me ? (
        <div className="mx-auto max-w-xl px-6 py-12">
          <p className="eyebrow">Shop computer</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-brown">
            Sign in to this desk
          </h1>
          <p className="mt-4 text-lg text-secondary leading-relaxed">
            PIN is enough without a phone. QR is optional. Magic links stay for
            home use of the website.
          </p>
          {billing ? (
            <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-brown">
              {billing.hint}
            </p>
          ) : null}

          <div className="mt-8 flex gap-2">
            <Button
              type="button"
              variant={tab === "pin" ? "default" : "outline"}
              onClick={() => setTab("pin")}
            >
              PIN
            </Button>
            <Button
              type="button"
              variant={tab === "qr" ? "default" : "outline"}
              onClick={() => {
                setTab("qr");
                if (!qr) void startQr();
              }}
            >
              QR
            </Button>
          </div>

          {tab === "pin" ? (
            <form onSubmit={login} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email on your membership</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              {error ? (
                <p className="text-sm text-accent" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : (
            <div className="mt-8">
              {qr ? (
                <div className="rounded-[2rem] border border-border bg-surface p-6 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr.qrDataUrl}
                    alt="Approve this desk on your phone"
                    className="mx-auto h-56 w-56"
                  />
                  <p className="mt-4 font-display text-3xl font-semibold tracking-[0.3em] text-brown">
                    {qr.userCode}
                  </p>
                  <p className="mt-2 text-sm text-secondary">
                    Scan with your phone and approve. Code expires in a few
                    minutes.
                  </p>
                </div>
              ) : (
                <Button type="button" onClick={() => void startQr()} disabled={pending}>
                  Show QR
                </Button>
              )}
              {error ? (
                <p className="mt-4 text-sm text-accent" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Signed in</p>
              <h1 className="mt-2 font-display text-4xl font-semibold text-brown">
                {me.user.displayName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill
                  tone={me.user.status === "active" ? "ok" : "danger"}
                >
                  {me.user.status}
                </StatusPill>
                <StatusPill tone="info">{formatTier(me.user.tier)}</StatusPill>
                <StatusPill tone={me.waiverCurrent ? "ok" : "warn"}>
                  {me.waiverCurrent ? "Waiver current" : "Waiver needed"}
                </StatusPill>
                {!me.user.shopAccess ? (
                  <StatusPill tone="muted">No shop access</StatusPill>
                ) : null}
              </div>
            </div>
            <Button variant="outline" onClick={() => void logout()}>
              Log out
            </Button>
          </div>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-border bg-surface px-5 py-5">
              <p className="eyebrow">Machine credits</p>
              <p className="mt-2 font-display text-4xl font-semibold text-brown">
                {formatMoneyExact(me.creditBalanceCents)}
              </p>
              <p className="mt-2 text-sm text-secondary">
                Wallet in this app. Jobs can go negative; the next grant pays
                the debt first. This login does not debit it.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-primary/30 bg-primary/10 px-5 py-5">
              <p className="eyebrow">This desk</p>
              <p className="mt-2 text-sm text-brown leading-relaxed">
                {me.session.billing.hint}
              </p>
            </div>
          </section>

          <p className="mt-6 max-w-3xl text-sm text-secondary leading-relaxed">
            PIN/QR is who you are and which software you may open. Launching
            vendor software is not a physical machine lock — there is no ESP32
            on these desks. Logout does not cancel a print already on the
            printer or in the Windows spooler.
          </p>

          {me.session.billing.mode !== "free" ? (
            <section className="mt-10">
              <p className="eyebrow">Send a job</p>
              <p className="mt-2 max-w-2xl text-sm text-secondary">
                Charge is the print or cut you send, not time sitting here.
                Monthly credit applies first. Unlimited members are logged at
                $0 machine time.
              </p>
              <form
                onSubmit={(e) => void sendJob(e)}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                {me.session.billing.mode === "per_gram" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="job-machine">Printer</Label>
                      <select
                        id="job-machine"
                        className="flex h-11 min-w-56 rounded-full border border-border bg-surface px-4 font-display text-sm"
                        value={jobMachineId || printers[0]?.machineId || ""}
                        onChange={(e) => setJobMachineId(e.target.value)}
                      >
                        {printers.map((p) => (
                          <option key={p.machineId} value={p.machineId}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filament-grams">Filament used (g)</Label>
                      <Input
                        id="filament-grams"
                        inputMode="decimal"
                        value={grams}
                        onChange={(e) => setGrams(e.target.value)}
                        placeholder="e.g. 50"
                      />
                    </div>
                  </>
                ) : null}
                {me.session.billing.mode === "hourly_job" ? (
                  <div className="space-y-2">
                    <Label htmlFor="runtime-minutes">
                      Estimated run time (minutes)
                    </Label>
                    <Input
                      id="runtime-minutes"
                      inputMode="numeric"
                      value={runtimeMinutes}
                      onChange={(e) => setRuntimeMinutes(e.target.value)}
                      placeholder="e.g. 12"
                    />
                  </div>
                ) : null}
                {me.session.billing.mode === "per_print" ? (
                  <div className="space-y-2">
                    <Label htmlFor="print-count">Prints</Label>
                    <Input
                      id="print-count"
                      inputMode="numeric"
                      value={prints}
                      onChange={(e) => setPrints(e.target.value)}
                    />
                  </div>
                ) : null}
                <Button
                  type="submit"
                  disabled={jobPending || !jobQuote || jobQuote.listCents <= 0}
                >
                  {jobPending ? "Sending…" : "Send job"}
                </Button>
              </form>
              {jobQuote && (jobQuote.grams || jobQuote.minutesBilled || jobQuote.prints) ? (
                <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-brown">
                  If you send this job:{" "}
                  <strong>
                    {jobQuote.unlimited
                      ? `${formatMoneyExact(0)} (Unlimited · logged, not charged)`
                      : formatMoneyExact(jobQuote.billedCents)}
                  </strong>
                  {jobQuote.minimumApplied && !jobQuote.unlimited
                    ? ` (minimum applied)`
                    : ""}
                  {jobQuote.setupWaived ? " · plasma setup waived this weekend" : ""}
                  . Not a live session clock.
                </p>
              ) : (
                <p className="mt-3 text-sm text-secondary">
                  Enter the job details to see the charge before you send.
                </p>
              )}
              {me.jobs.length > 0 ? (
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {me.jobs.slice(0, 6).map((j) => (
                    <li
                      key={j.id}
                      className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                    >
                      <span className="font-display font-medium text-brown">
                        {j.note ?? j.machineName}
                      </span>
                      <span className="text-secondary">
                        {j.status === "refunded"
                          ? "Refunded"
                          : formatMoneyExact(j.billedCents ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="mt-10">
            <p className="eyebrow">Certifications</p>
            {me.certifications.filter((c) => c.status === "certified").length >
            0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {me.certifications
                  .filter((c) => c.status === "certified")
                  .map((c) => (
                    <li key={c.id}>
                      <StatusPill tone="ok">{c.name}</StatusPill>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-3 text-secondary">None certified yet.</p>
            )}
          </section>

          <section className="mt-10">
            <p className="eyebrow">Upcoming reservations</p>
            {me.reservations.length > 0 ? (
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {me.reservations.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap justify-between gap-2 py-3"
                  >
                    <span className="font-display font-medium text-brown">
                      {r.machineName}
                    </span>
                    <span className="text-sm text-secondary">
                      {formatDateTime(r.startsAt)} – {formatDateTime(r.endsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-secondary">No upcoming reservations.</p>
            )}
          </section>

          {config.generalSoftware.length > 0 ? (
            <section className="mt-10">
              <p className="eyebrow">General software</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {config.generalSoftware.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant="secondary"
                    onClick={() => void launch(s.id, null)}
                  >
                    Launch {s.displayName}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <p className="eyebrow">Equipment</p>
            {launchNote ? (
              <p className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-brown">
                {launchNote}
              </p>
            ) : null}
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {config.equipment.map((eq) => {
                const certified = eq.requiredCertificationIds.every((id) =>
                  certSet.has(id),
                );
                return (
                  <li
                    key={eq.machineId}
                    className="rounded-2xl border border-border bg-surface px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-secondary">
                          {eq.areaLabel}
                        </p>
                        <h2 className="mt-1 font-display text-lg font-semibold text-brown">
                          {eq.name}
                        </h2>
                        <p className="mt-1 text-sm text-secondary">
                          {eq.locationLabel}
                        </p>
                      </div>
                      <StatusPill tone={certified ? "ok" : "warn"}>
                        {certified ? "Certified" : "Request training"}
                      </StatusPill>
                    </div>
                    <div className="mt-4">
                      {eq.software ? (
                        certified ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void launch(eq.software!.id, eq.machineId)
                            }
                          >
                            Launch {eq.software.displayName}
                          </Button>
                        ) : (
                          <a
                            href="/learn"
                            className="font-display text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
                          >
                            Request training
                          </a>
                        )
                      ) : certified ? (
                        <p className="text-sm text-secondary">
                          No app mapped to this desk
                        </p>
                      ) : (
                        <a
                          href="/learn"
                          className="font-display text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
                        >
                          Request training
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
