import { INVENTORY_ASSET_TAG_PREFIX } from "./config";

export function formatAssetTag(
  tagNumber: number,
  prefix = INVENTORY_ASSET_TAG_PREFIX,
): string {
  const n = Math.max(0, Math.floor(tagNumber));
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

export function parseAssetTag(
  raw: string,
  prefix = INVENTORY_ASSET_TAG_PREFIX,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const prefixed = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[- ]?(\\d+)$`,
    "i",
  );
  const match = trimmed.match(prefixed) ?? trimmed.match(/^(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function normalizeAssetTag(
  raw: string,
  prefix = INVENTORY_ASSET_TAG_PREFIX,
): string | null {
  const n = parseAssetTag(raw, prefix);
  return n == null ? null : formatAssetTag(n, prefix);
}
