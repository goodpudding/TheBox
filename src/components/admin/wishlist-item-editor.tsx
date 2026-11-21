"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WishlistItem, WishlistZone } from "@/lib/data";

type Draft = {
  id?: string;
  zoneId: string;
  name: string;
  model: string;
  qty: string;
  price: string;
  estimated: boolean;
  url: string;
  note: string;
};

function draftFrom(item: WishlistItem): Draft {
  return {
    id: item.id,
    zoneId: item.zoneId,
    name: item.name,
    model: item.model,
    qty: String(item.qty),
    price: (item.priceCents / 100).toFixed(2),
    estimated: item.estimated,
    url: item.url ?? "",
    note: item.note ?? "",
  };
}

/**
 * Add, change and remove wishlist items. The list above this on the page
 * handles what donors do (reports, marking purchased); this handles what the
 * shop is asking for.
 */
export function WishlistItemEditor({
  zones,
  items,
}: {
  zones: WishlistZone[];
  items: WishlistItem[];
}) {
  const { provider, bump } = useData();
  const [zoneId, setZoneId] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeZone = zoneId || zones[0]?.id || "";
  const inZone = useMemo(
    () =>
      items
        .filter((i) => i.zoneId === activeZone)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items, activeZone],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await provider.adminSaveWishlistItem({
        id: draft.id,
        zoneId: draft.zoneId,
        name: draft.name,
        model: draft.model,
        qty: Number(draft.qty),
        priceCents: Math.round(Number(draft.price) * 100),
        estimated: draft.estimated,
        url: draft.url.trim() || null,
        note: draft.note.trim() || null,
      });
      setMessage(`Saved ${saved.name}.`);
      setZoneId(saved.zoneId);
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(item: WishlistItem) {
    if (!window.confirm(`Take ${item.name} off the wishlist?`)) return;
    setError(null);
    setMessage(null);
    try {
      await provider.adminDeleteWishlistItem(item.id);
      setMessage(`Removed ${item.name}.`);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    }
  }

  return (
    <section className="mt-14 border-t border-border pt-10">
      <p className="eyebrow">Catalog</p>
      <h2 className="mt-2 font-display text-xl font-semibold text-brown">
        Items on the wishlist
      </h2>
      <div className="mt-4">
        <AdminNotice message={message} error={error} />
      </div>

      {draft ? (
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-5">
          <h3 className="font-display text-lg font-semibold text-brown">
            {draft.id ? "Edit item" : "Add an item"}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="wl-zone">Zone</Label>
            <select
              id="wl-zone"
              value={draft.zoneId}
              onChange={(e) => setDraft({ ...draft, zoneId: e.target.value })}
              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-name">Item</Label>
            <Input
              id="wl-name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-model">Exact model</Label>
            <Input
              id="wl-model"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wl-price">Price each ($)</Label>
              <Input
                id="wl-price"
                required
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-qty">How many</Label>
              <Input
                id="wl-qty"
                required
                inputMode="numeric"
                value={draft.qty}
                onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={draft.estimated}
              onChange={(e) => setDraft({ ...draft, estimated: e.target.checked })}
            />
            The price is an estimate
          </label>
          <div className="space-y-2">
            <Label htmlFor="wl-url">Link to buy it (optional)</Label>
            <Input
              id="wl-url"
              type="url"
              placeholder="https://"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-note">Note (optional)</Label>
            <Input
              id="wl-note"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save item"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="wl-filter">Zone</Label>
              <select
                id="wl-filter"
                value={activeZone}
                onChange={(e) => setZoneId(e.target.value)}
                className="h-11 rounded-full border border-border bg-surface px-4 text-charcoal"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={!activeZone}
              onClick={() => {
                setMessage(null);
                setError(null);
                setDraft({
                  zoneId: activeZone,
                  name: "",
                  model: "",
                  qty: "1",
                  price: "",
                  estimated: false,
                  url: "",
                  note: "",
                });
              }}
            >
              Add an item
            </Button>
          </div>
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {inZone.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-display font-semibold text-brown">{item.name}</p>
                  <p className="text-sm text-secondary">
                    {item.model ? `${item.model} · ` : ""}${(item.priceCents / 100).toFixed(2)}
                    {item.qty > 1 ? ` × ${item.qty}` : ""}
                    {item.status === "fulfilled" ? " · purchased" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      setDraft(draftFrom(item));
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => void onDelete(item)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {inZone.length === 0 ? (
            <p className="mt-4 text-secondary">Nothing in this zone yet.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
