"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { InventoryPhoto } from "@/components/inventory-photo";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/components/providers";
import {
  canInventory,
  conditionLabel,
  STATUS_LABELS,
  toCsvRow,
} from "@/lib/inventory";
import type {
  InventoryArea,
  InventoryItemView,
  ItemCondition,
  ItemStatus,
} from "@/lib/data";

function statusTone(status: ItemStatus): "ok" | "warn" | "danger" | "muted" {
  if (status === "ACTIVE") return "ok";
  if (status === "IN_REPAIR" || status === "OUT_ON_LOAN") return "warn";
  if (status === "MISSING") return "danger";
  return "muted";
}

export default function InventoryBrowsePage() {
  return (
    <MemberGate>
      <InventoryBrowseBody />
    </MemberGate>
  );
}

function InventoryBrowseBody() {
  const { provider, currentUser, revision } = useData();
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [areas, setAreas] = useState<InventoryArea[]>([]);
  const [search, setSearch] = useState("");
  const [areaId, setAreaId] = useState("");
  const [condition, setCondition] = useState<ItemCondition | "">("");
  const [status, setStatus] = useState<ItemStatus | "">("");
  const [includeRetired, setIncludeRetired] = useState(false);
  const [loading, setLoading] = useState(true);

  const staff = currentUser
    ? canInventory(currentUser, "printLabels")
    : false;

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [list, areaList] = await Promise.all([
        provider.listInventoryItems(currentUser.id, {
          search: search || undefined,
          areaId: areaId || undefined,
          condition: condition || undefined,
          status: status || undefined,
          includeRetired,
          includePending: false,
        }),
        provider.listInventoryAreas(),
      ]);
      if (cancelled) return;
      setItems(list.filter((i) => i.reviewStatus === "APPROVED"));
      setAreas(areaList.filter((a) => a.active));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    provider,
    currentUser,
    revision,
    search,
    areaId,
    condition,
    status,
    includeRetired,
  ]);

  const tableRows = useMemo(() => items, [items]);

  function exportCsv() {
    const header = [
      "assetTag",
      "name",
      "model",
      "manufacturer",
      "serialNumber",
      "quantity",
      "area",
      "location",
      "condition",
      "status",
    ];
    const lines = [
      header.join(","),
      ...tableRows.map((item) =>
        toCsvRow([
          item.assetTag,
          item.name,
          item.model,
          item.manufacturer,
          item.serialNumber,
          item.quantity,
          item.areaName,
          item.location,
          item.condition,
          item.status,
        ]),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHero
          eyebrow="Shop"
          title="Inventory"
          description="Every tool, machine, and item on the floor. Scan a QR label to open an item on your phone."
        />
        {currentUser && canInventory(currentUser, "submit") ? (
          <Button asChild>
            <Link href="/inventory/new">Add item</Link>
          </Button>
        ) : null}
      </div>
      <InventorySubnav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, model, serial, tag"
          aria-label="Search inventory"
        />
        <select
          className="h-11 rounded-full border border-border bg-surface px-4 font-display text-sm"
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          aria-label="Filter by area"
        >
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-full border border-border bg-surface px-4 font-display text-sm"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ItemCondition | "")}
          aria-label="Filter by condition"
        >
          <option value="">Any condition</option>
          <option value="NEW">New</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="NEEDS_REPAIR">Needs repair</option>
          <option value="BROKEN">Broken</option>
        </select>
        <select
          className="h-11 rounded-full border border-border bg-surface px-4 font-display text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as ItemStatus | "")}
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="IN_REPAIR">In repair</option>
          <option value="OUT_ON_LOAN">Out on loan</option>
          <option value="MISSING">Missing</option>
        </select>
        <label className="flex items-center gap-2 font-display text-sm text-secondary">
          <input
            type="checkbox"
            checked={includeRetired}
            onChange={(e) => setIncludeRetired(e.target.checked)}
          />
          Include retired
        </label>
      </div>

      {staff ? (
        <div className="mt-4">
          <Button type="button" variant="secondary" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-8 text-secondary">Loading inventory…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-secondary">No approved items match those filters.</p>
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:hidden">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/inventory/${item.assetTag}`}
                  className="block overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <InventoryPhoto
                    storageKey={item.frontPhoto?.thumbKey ?? item.frontPhoto?.storageKey}
                    alt=""
                    className="h-40 w-full"
                  />
                  <div className="p-4">
                    <p className="font-display text-xs font-semibold text-primary-text">
                      {item.assetTag}
                    </p>
                    <h2 className="mt-1 font-display text-lg font-semibold text-brown">
                      {item.name}
                    </h2>
                    <p className="mt-1 text-sm text-secondary">
                      {[item.manufacturer, item.model, item.areaName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone={statusTone(item.status)}>
                        {STATUS_LABELS[item.status]}
                      </StatusPill>
                      <StatusPill>{conditionLabel(item.condition)}</StatusPill>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-border bg-surface lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border font-display text-xs uppercase tracking-wider text-secondary">
                <tr>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-display text-primary-text">
                      <Link href={`/inventory/${item.assetTag}`} className="hover:underline">
                        {item.assetTag}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/inventory/${item.assetTag}`} className="font-medium text-brown hover:underline">
                        {item.name}
                      </Link>
                      <p className="text-secondary">
                        {[item.manufacturer, item.model].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-secondary">{item.areaName ?? "—"}</td>
                    <td className="px-4 py-3 text-secondary">{item.location ?? "—"}</td>
                    <td className="px-4 py-3">{conditionLabel(item.condition)}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={statusTone(item.status)}>
                        {STATUS_LABELS[item.status]}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageShell>
  );
}
