"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { Button } from "@/components/ui/button";
import { useData } from "@/components/providers";
import { canInventory } from "@/lib/inventory";
import type { AreaSteward, InventoryItemView } from "@/lib/data";

type Sheet = "avery-5160" | "thermal-2x1";

export default function InventoryLabelsPage() {
  return (
    <MemberGate>
      <LabelsBody />
    </MemberGate>
  );
}

function LabelsBody() {
  const { provider, currentUser, bump } = useData();
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<Sheet>("avery-5160");
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [stewards, setStewards] = useState<AreaSteward[]>([]);
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void Promise.all([
      provider.listInventoryItems(currentUser.id, { includeRetired: false }),
      provider.listAreaStewards(),
    ]).then(([list, rows]) => {
      if (cancelled) return;
      const approved = list.filter((i) => i.reviewStatus === "APPROVED");
      setItems(approved);
      setStewards(rows);
      setSelected(
        new Set(approved.filter((i) => !i.labelPrintedAt).map((i) => i.id)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [provider, currentUser]);

  const chosen = useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      chosen.map(async (item) => {
        const url = `${origin}/i/${item.assetTag}`;
        const svg = await QRCode.toString(url, {
          type: "svg",
          margin: 0,
          width: 128,
        });
        return [item.id, svg] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setSvgs(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [chosen, origin]);

  if (
    currentUser &&
    !canInventory(currentUser, "printLabels", { stewards })
  ) {
    return (
      <PageShell>
        <PageHero eyebrow="Inventory" title="Labels" description="Staff only." />
      </PageShell>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Inventory"
        title="Print QR labels"
        description="Each label is the short URL /i/BX-00042, the asset tag, and the item name."
      />
      <InventorySubnav />
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <select
          className="h-11 rounded-full border border-border bg-surface px-4 font-display text-sm"
          value={sheet}
          onChange={(e) => setSheet(e.target.value as Sheet)}
        >
          <option value="avery-5160">Avery 5160 (30 per sheet)</option>
          <option value="thermal-2x1">Thermal 2×1 in</option>
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setSelected(
              new Set(items.filter((i) => !i.labelPrintedAt).map((i) => i.id)),
            )
          }
        >
          Unprinted only
        </Button>
        <Button type="button" onClick={() => window.print()}>
          Print
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!currentUser) return;
            void provider
              .markInventoryLabelsPrinted(currentUser.id, [...selected])
              .then(bump);
          }}
        >
          Mark printed
        </Button>
      </div>

      <ul className="mb-6 max-h-48 overflow-auto rounded-2xl border border-border bg-surface p-3 print:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span className="font-display text-primary-text">{item.assetTag}</span>
              {item.name}
              {item.labelPrintedAt ? (
                <span className="text-secondary"> · printed</span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>

      <div
        className={
          sheet === "avery-5160"
            ? "grid grid-cols-3 gap-2 print:gap-0"
            : "grid grid-cols-2 gap-4"
        }
      >
        {chosen.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 print:rounded-none"
          >
            <div
              className="h-16 w-16 shrink-0 text-brown"
              dangerouslySetInnerHTML={{ __html: svgs[item.id] ?? "" }}
            />
            <div>
              <p className="font-display text-sm font-bold text-brown">
                {item.assetTag}
              </p>
              <p className="text-xs text-charcoal">{item.name}</p>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
