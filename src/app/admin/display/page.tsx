"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  DisplayConfig,
  DisplayPanelId,
  NameDisplayMode,
  PromoSlide,
} from "@/lib/data";

const PANEL_LABELS: Record<DisplayPanelId, string> = {
  today: "Today at The Box",
  machines: "Machine status",
  upcoming: "Coming up",
  certs: "Get certified",
  promos: "Promos",
  membership: "Membership",
};

const ALL_PANELS: DisplayPanelId[] = [
  "today",
  "machines",
  "upcoming",
  "certs",
  "promos",
  "membership",
];

function displayUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/display?token=${encodeURIComponent(token)}`;
}

function emptyPromo(): {
  id?: string;
  title: string;
  body: string;
  imageUrl: string;
  qrUrl: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  sortOrder: number;
} {
  const start = new Date();
  const end = new Date(Date.now() + 30 * 24 * 3600_000);
  return {
    title: "",
    body: "",
    imageUrl: "",
    qrUrl: "",
    startsAt: start.toISOString().slice(0, 16),
    endsAt: end.toISOString().slice(0, 16),
    active: true,
    sortOrder: 1,
  };
}

export default function AdminDisplayPage() {
  const { provider, revision, bump } = useData();
  const [promos, setPromos] = useState<PromoSlide[]>([]);
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [form, setForm] = useState(emptyPromo());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token =
    process.env.NEXT_PUBLIC_DISPLAY_TOKEN?.trim() ||
    "dev-display-token-change-me";

  useEffect(() => {
    void (async () => {
      const [p, c] = await Promise.all([
        provider.listPromos(),
        provider.getDisplayConfig(),
      ]);
      setPromos(p);
      setConfig(c);
    })();
  }, [provider, revision]);

  const previewSrc = useMemo(() => displayUrl(token), [token]);

  async function saveConfig(next: Partial<DisplayConfig>) {
    setPending(true);
    setError(null);
    try {
      const updated = await provider.saveDisplayConfig(next);
      setConfig(updated);
      bump();
      setMessage("Display settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setPending(false);
    }
  }

  async function onSavePromo(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await provider.savePromo({
        id: form.id,
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.imageUrl.trim() || null,
        qrUrl: form.qrUrl.trim() || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        active: form.active,
        sortOrder: form.sortOrder,
      });
      setForm(emptyPromo());
      bump();
      setMessage(form.id ? "Promo updated." : "Promo created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save promo");
    } finally {
      setPending(false);
    }
  }

  async function onUpload(file: File) {
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/display/upload", { method: "POST", body });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Upload failed");
    }
    const data = (await res.json()) as { url: string };
    setForm((f) => ({ ...f, imageUrl: data.url }));
  }

  function movePanel(id: DisplayPanelId, dir: -1 | 1) {
    if (!config) return;
    const order = [...config.panelOrder];
    const i = order.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    void saveConfig({ panelOrder: order });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(previewSrc);
      setMessage("Display URL copied.");
    } catch {
      setError("Could not copy URL");
    }
  }

  return (
    <AdminShell
      title="Lobby display"
      description="Promos, panel rotation, and the kiosk URL for the front-of-shop TV."
    >
      {error ? (
        <p className="mb-4 text-sm text-brown" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="mb-4 text-sm text-secondary">{message}</p> : null}

      <section className="max-w-3xl">
        <h2 className="font-display text-xl font-semibold text-brown">
          Display URL
        </h2>
        <p className="mt-2 break-all font-mono text-sm text-secondary">
          {previewSrc}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void copyUrl()}>
            Copy
          </Button>
          <Button asChild size="sm" variant="secondary">
            <a href={previewSrc} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        </div>
        <p className="mt-2 text-sm text-secondary">
          Set <code className="font-mono">DISPLAY_TOKEN</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_DISPLAY_TOKEN</code> to the
          same long random value in <code className="font-mono">.env</code>.
        </p>
      </section>

      {config ? (
        <section className="mt-12 max-w-xl space-y-4">
          <h2 className="font-display text-xl font-semibold text-brown">
            Panels
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {config.panelOrder.map((id) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="font-display font-semibold text-brown">
                  {PANEL_LABELS[id]}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => movePanel(id, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => movePanel(id, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      config.pinnedPanel === id ? "default" : "secondary"
                    }
                    onClick={() =>
                      void saveConfig({
                        pinnedPanel: config.pinnedPanel === id ? null : id,
                      })
                    }
                  >
                    {config.pinnedPanel === id ? "Pinned" : "Pin"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Label htmlFor="cadence">Cadence (seconds)</Label>
            <Input
              id="cadence"
              type="number"
              min={5}
              max={120}
              defaultValue={config.cadenceSeconds}
              onBlur={(e) =>
                void saveConfig({ cadenceSeconds: Number(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nameMode">Name on in-use machines</Label>
            <select
              id="nameMode"
              className="flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm"
              value={config.nameDisplayMode}
              onChange={(e) =>
                void saveConfig({
                  nameDisplayMode: e.target.value as NameDisplayMode,
                })
              }
            >
              <option value="none">None</option>
              <option value="first">First name</option>
              <option value="firstLast">First + last initial</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="membershipN">Membership every N rotations</Label>
            <Input
              id="membershipN"
              type="number"
              min={1}
              defaultValue={config.membershipEveryNRotations}
              onBlur={(e) =>
                void saveConfig({
                  membershipEveryNRotations: Number(e.target.value),
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Add missing panels</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_PANELS.filter((p) => !config.panelOrder.includes(p)).map(
                (p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void saveConfig({
                        panelOrder: [...config.panelOrder, p],
                      })
                    }
                  >
                    + {PANEL_LABELS[p]}
                  </Button>
                ),
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-12 max-w-xl">
        <h2 className="font-display text-xl font-semibold text-brown">
          {form.id ? "Edit promo" : "New promo"}
        </h2>
        <form onSubmit={onSavePromo} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              required
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={form.imageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageUrl: e.target.value }))
              }
            />
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file).catch((err) => setError(String(err)));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qrUrl">QR target URL</Label>
            <Input
              id="qrUrl"
              value={form.qrUrl}
              onChange={(e) => setForm((f) => ({ ...f, qrUrl: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startsAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                required
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
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
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : form.id ? "Save promo" : "Create promo"}
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setForm(emptyPromo())}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Promo catalog
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {promos.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="font-display font-semibold text-brown">{p.title}</p>
                <p className="text-sm text-secondary">
                  {new Date(p.startsAt).toLocaleDateString()} →{" "}
                  {new Date(p.endsAt).toLocaleDateString()}
                  {p.active ? "" : " · inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      title: p.title,
                      body: p.body,
                      imageUrl: p.imageUrl ?? "",
                      qrUrl: p.qrUrl ?? "",
                      startsAt: p.startsAt.slice(0, 16),
                      endsAt: p.endsAt.slice(0, 16),
                      active: p.active,
                      sortOrder: p.sortOrder,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void provider.deletePromo(p.id).then(() => bump())
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Live preview
        </h2>
        <iframe
          title="Lobby display preview"
          src={previewSrc}
          className="mt-4 h-[480px] w-full max-w-4xl rounded-2xl border border-border bg-page"
        />
      </section>
    </AdminShell>
  );
}
