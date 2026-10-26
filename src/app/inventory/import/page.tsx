"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/components/providers";
import {
  canInventory,
  defaultColumnMapping,
  INVENTORY_CSV_FIELDS,
  matchAreaId,
  parseCondition,
  parseCsvText,
  type InventoryCsvField,
} from "@/lib/inventory";
import type {
  AreaSteward,
  InventoryArea,
  InventoryCsvMappedRow,
  InventoryImportResult,
} from "@/lib/data";

const FIELD_LABELS: Record<InventoryCsvField, string> = {
  name: "Item name",
  model: "Model",
  manufacturer: "Manufacturer",
  serialNumber: "Serial",
  quantity: "Quantity",
  condition: "Condition",
  area: "Area",
  location: "Location",
  notes: "Notes",
  frontPhoto: "Front photo (Drive link)",
  sidePhoto: "Side photo",
  serialPhoto: "Serial photo",
};

export default function InventoryImportPage() {
  return (
    <MemberGate>
      <ImportBody />
    </MemberGate>
  );
}

function ImportBody() {
  const { provider, currentUser, bump } = useData();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<InventoryCsvField, number | null>>(
    () => defaultColumnMapping([]),
  );
  const [areas, setAreas] = useState<InventoryArea[]>([]);
  const [stewards, setStewards] = useState<AreaSteward[]>([]);
  const [result, setResult] = useState<InventoryImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      provider.listInventoryAreas(),
      provider.listAreaStewards(),
    ]).then(([a, s]) => {
      if (cancelled) return;
      setAreas(a);
      setStewards(s);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const mapped: InventoryCsvMappedRow[] = useMemo(() => {
    return rows.map((row) => {
      const cell = (field: InventoryCsvField) => {
        const idx = mapping[field];
        return idx == null ? "" : (row[idx] ?? "").trim();
      };
      const serial = cell("serialNumber");
      return {
        name: cell("name"),
        model: cell("model") || null,
        manufacturer: cell("manufacturer") || null,
        serialNumber: serial || null,
        quantity: Number(cell("quantity") || 1) || 1,
        condition: parseCondition(cell("condition") || "Good"),
        areaId: matchAreaId(cell("area"), areas),
        location: cell("location") || null,
        notes: cell("notes") || null,
        photoLinks: {
          FRONT: cell("frontPhoto") || undefined,
          SIDE: cell("sidePhoto") || undefined,
          SERIAL: cell("serialPhoto") || undefined,
        },
      };
    });
  }, [rows, mapping, areas]);

  if (
    currentUser &&
    !canInventory(currentUser, "importCsv", { stewards })
  ) {
    return (
      <PageShell>
        <PageHero eyebrow="Inventory" title="Import" description="Staff only." />
      </PageShell>
    );
  }

  async function run(dryRun: boolean) {
    if (!currentUser) return;
    setError(null);
    try {
      const out = await provider.importInventoryCsv(
        currentUser.id,
        mapped,
        dryRun,
      );
      setResult(out);
      if (!dryRun) bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Inventory"
        title="Import from Google Form"
        description="Upload a CSV from the response Sheet. Map columns, dry-run, then commit. Rows land as pending. Drive photo links copy when the service account is configured."
      />
      <InventorySubnav />

      {error ? (
        <p className="mb-4 rounded-xl bg-accent/15 px-4 py-3 text-sm text-brown">
          {error}
        </p>
      ) : null}

      <div className="space-y-6">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const parsed = parseCsvText(text);
              setHeaders(parsed.headers);
              setRows(parsed.rows);
              setMapping(defaultColumnMapping(parsed.headers));
              setResult(null);
            });
          }}
        />

        {headers.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {INVENTORY_CSV_FIELDS.map((field) => (
              <label key={field} className="block font-display text-sm">
                <span className="text-secondary">{FIELD_LABELS[field]}</span>
                <select
                  className="mt-1 h-11 w-full rounded-full border border-border bg-surface px-4"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [field]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">— skip —</option>
                  {headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        {currentUser && canInventory(currentUser, "manageAreas", { stewards }) ? (
          <form
            className="flex max-w-lg flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!currentUser || !newAreaName.trim()) return;
              const slug = newAreaName
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-");
              void provider
                .upsertInventoryArea(currentUser.id, {
                  slug,
                  name: newAreaName.trim(),
                })
                .then((area) => {
                  setAreas((list) =>
                    list.some((a) => a.id === area.id)
                      ? list.map((a) => (a.id === area.id ? area : a))
                      : [...list, area],
                  );
                  setNewAreaName("");
                  bump();
                });
            }}
          >
            <div className="flex-1">
              <Label htmlFor="new-area">Add area</Label>
              <Input
                id="new-area"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="General / Shop"
              />
            </div>
            <Button type="submit" size="sm">
              Save area
            </Button>
          </form>
        ) : null}

        {mapped.length > 0 ? (
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => void run(true)}>
              Dry-run preview
            </Button>
            <Button type="button" onClick={() => void run(false)}>
              Import {mapped.length} rows
            </Button>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-display font-semibold text-brown">
              {result.dryRun ? "Dry run" : "Imported"} · {result.created} created
              {result.failed.length ? ` · ${result.failed.length} failed` : ""}
            </p>
            <ul className="mt-3 max-h-64 overflow-auto text-sm">
              {result.preview.map((row) => (
                <li key={row.row}>
                  Row {row.row}: {row.name} ({row.condition}
                  {row.photoCount ? `, ${row.photoCount} photos` : ""})
                </li>
              ))}
            </ul>
            {result.failed.length > 0 ? (
              <ul className="mt-3 text-sm text-brown">
                {result.failed.map((f) => (
                  <li key={`${f.row}-${f.reason}`}>
                    Row {f.row}: {f.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
