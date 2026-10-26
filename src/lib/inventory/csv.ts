import type {
  ItemCondition,
  InventoryArea,
} from "@/lib/data/types";

export const INVENTORY_CSV_FIELDS = [
  "name",
  "model",
  "manufacturer",
  "serialNumber",
  "quantity",
  "condition",
  "area",
  "location",
  "notes",
  "frontPhoto",
  "sidePhoto",
  "serialPhoto",
] as const;

export type InventoryCsvField = (typeof INVENTORY_CSV_FIELDS)[number];

const FIELD_ALIASES: Record<InventoryCsvField, string[]> = {
  name: [
    "item name",
    "name",
    "what is the item",
    "what is it",
    "item",
    "tool name",
  ],
  model: ["product / model name", "model", "product name", "model name"],
  manufacturer: ["manufacturer", "brand", "manufacturer / brand"],
  serialNumber: ["serial number", "serial", "serial / label"],
  quantity: ["quantity", "qty", "count"],
  condition: ["condition", "item condition"],
  area: ["area", "shop area", "workspace", "station"],
  location: ["location", "where is it", "shelf", "location in the shop"],
  notes: ["notes", "comments", "missing parts", "accessories"],
  frontPhoto: [
    "front photo",
    "photo of the item",
    "item photo",
    "photo",
    "front of item",
  ],
  sidePhoto: ["side photo", "side profile", "side of item"],
  serialPhoto: ["serial photo", "serial / label photo", "label photo"],
};

const CONDITION_MAP: Record<string, ItemCondition> = {
  new: "NEW",
  "like new": "NEW",
  "new / like new": "NEW",
  good: "GOOD",
  fair: "FAIR",
  "needs repair": "NEEDS_REPAIR",
  repair: "NEEDS_REPAIR",
  broken: "BROKEN",
};

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      current.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      current.push(cell);
      cell = "";
      if (current.some((c) => c.trim() !== "")) rows.push(current);
      current = [];
      continue;
    }
    cell += ch;
  }
  current.push(cell);
  if (current.some((c) => c.trim() !== "")) rows.push(current);
  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows };
}

export function defaultColumnMapping(
  headers: string[],
): Record<InventoryCsvField, number | null> {
  const mapping = Object.fromEntries(
    INVENTORY_CSV_FIELDS.map((f) => [f, null]),
  ) as Record<InventoryCsvField, number | null>;
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const field of INVENTORY_CSV_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    const idx = normalized.findIndex((h) =>
      aliases.some((a) => h === a || h.includes(a)),
    );
    if (idx >= 0) mapping[field] = idx;
  }
  return mapping;
}

export function parseCondition(raw: string): ItemCondition {
  const key = raw.trim().toLowerCase();
  return CONDITION_MAP[key] ?? "GOOD";
}

export function matchAreaId(
  raw: string,
  areas: Pick<InventoryArea, "id" | "name" | "slug">[],
): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const hit = areas.find(
    (a) =>
      a.slug === key ||
      a.name.toLowerCase() === key ||
      a.name.toLowerCase().includes(key) ||
      key.includes(a.slug),
  );
  return hit?.id ?? null;
}

export function driveLinkFromCell(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const patterns = [
    /\/(?:d|folders)\/([A-Za-z0-9_-]{19,})/,
    /[?&]id=([A-Za-z0-9_-]{19,})/,
  ];
  for (const re of patterns) {
    const m = v.match(re);
    if (m) return m[1] ?? null;
  }
  return /^[A-Za-z0-9_-]{19,}$/.test(v) ? v : null;
}

export function toCsvRow(values: Array<string | number | null | undefined>): string {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(",");
}
