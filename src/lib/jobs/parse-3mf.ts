/**
 * Read a sliced Bambu 3MF. See docs/machine-billing-spec.md §8.
 * No I/O — pass the file bytes. Storage belongs to the job API.
 */
import { strFromU8, unzipSync } from "fflate";

export const SLICE_BEFORE_EXPORT_MESSAGE =
  "Please slice before exporting — File ▸ Export ▸ Export plate sliced file";

/** Spec §8 upload cap. */
export const MAX_3MF_BYTES = 200 * 1024 * 1024;

export interface Parsed3mf {
  /** Sum of plate estimates, in minutes (prediction seconds / 60). */
  minutes: number;
  /** Sum of plate filament weights, in grams. */
  grams: number;
  /** Sliced plates that contributed to the totals. */
  plates: number;
}

interface PlateEstimate {
  seconds: number | null;
  grams: number | null;
}

export function parse3mf(data: Uint8Array | ArrayBuffer): Parsed3mf {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength > MAX_3MF_BYTES) {
    throw new Error("3MF is larger than 200 MB");
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("Not a valid 3MF file");
  }

  const files = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(entries)) {
    files.set(path.replace(/\\/g, "/"), content);
  }

  const plateGcode = [...files.keys()]
    .map((path) => {
      const match = path.match(/(?:^|\/)plate_(\d+)\.gcode$/i);
      if (!match || !/metadata/i.test(path)) return null;
      return { index: Number(match[1]), path };
    })
    .filter((plate): plate is { index: number; path: string } => plate != null)
    .sort((a, b) => a.index - b.index);

  if (plateGcode.length === 0) {
    throw new Error(SLICE_BEFORE_EXPORT_MESSAGE);
  }

  const fromSliceInfo = readSliceInfo(files);
  let totalSeconds = 0;
  let totalGrams = 0;

  for (const plate of plateGcode) {
    const info = fromSliceInfo.get(plate.index);
    const gcode = decodeHead(files.get(plate.path)!);
    const seconds = info?.seconds ?? parseGcodeSeconds(gcode);
    const grams = info?.grams ?? parseGcodeGrams(gcode);
    if (seconds == null || grams == null) {
      throw new Error(
        `Could not read the print estimate for plate ${plate.index}`,
      );
    }
    totalSeconds += seconds;
    totalGrams += grams;
  }

  return {
    minutes: totalSeconds / 60,
    grams: totalGrams,
    plates: plateGcode.length,
  };
}

function readSliceInfo(
  files: Map<string, Uint8Array>,
): Map<number, PlateEstimate> {
  const path = [...files.keys()].find((name) =>
    /(?:^|\/)slice_info\.config$/i.test(name),
  );
  const plates = new Map<number, PlateEstimate>();
  if (!path) return plates;

  const xml = strFromU8(files.get(path)!);
  const blocks = xml.split(/<plate\b[^>]*>/i).slice(1);
  blocks.forEach((block, ordinal) => {
    const body = block.split(/<\/plate>/i)[0] ?? block;
    const index = Number(metadataValue(body, "index") ?? ordinal + 1);
    const seconds = numberOrNull(metadataValue(body, "prediction"));
    const grams = numberOrNull(metadataValue(body, "weight"));
    plates.set(index, { seconds, grams });
  });
  return plates;
}

function metadataValue(block: string, key: string): string | null {
  const tags = block.match(/<metadata\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const tagKey = attr(tag, "key");
    if (tagKey?.toLowerCase() !== key.toLowerCase()) continue;
    return attr(tag, "value");
  }
  return null;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"),
  );
  return match?.[1] ?? null;
}

function numberOrNull(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Estimates sit in the gcode header, not the toolpath. */
function decodeHead(data: Uint8Array): string {
  const head = data.subarray(0, Math.min(data.length, 64 * 1024));
  return strFromU8(head);
}

function parseGcodeSeconds(text: string): number | null {
  const normal = text.match(
    /;\s*estimated printing time\s*\(normal mode\)\s*=\s*([^\r\n]+)/i,
  );
  const any = text.match(
    /;\s*estimated printing time[^\r\n=]*=\s*([^\r\n]+)/i,
  );
  return durationToSeconds((normal ?? any)?.[1] ?? "");
}

function parseGcodeGrams(text: string): number | null {
  const match = text.match(
    /;\s*total filament weight\s*\[g\]\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
  );
  return match ? Number(match[1]) : null;
}

function durationToSeconds(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const units: Array<[RegExp, number]> = [
    [/(\d+(?:\.\d+)?)\s*d\b/i, 86400],
    [/(\d+(?:\.\d+)?)\s*h\b/i, 3600],
    [/(\d+(?:\.\d+)?)\s*m\b/i, 60],
    [/(\d+(?:\.\d+)?)\s*s\b/i, 1],
  ];
  let seconds = 0;
  let found = false;
  for (const [pattern, multiplier] of units) {
    const match = text.match(pattern);
    if (!match) continue;
    found = true;
    seconds += Number(match[1]) * multiplier;
  }
  return found ? seconds : null;
}
