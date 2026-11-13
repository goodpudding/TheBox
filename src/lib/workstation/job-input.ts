/**
 * What a desk may send when it records a job. The member is billed from
 * these numbers, so the price itself is never taken from the request.
 */

export type JobRequest = {
  machineId: string;
  filamentGrams: number | null;
  prints: number | null;
  runtimeSeconds: number | null;
  note: string | null;
};

const MAX_GRAMS = 20_000; // 20 kg, far beyond any single print
const MAX_PRINTS = 1_000;
const MAX_RUNTIME_SECONDS = 7 * 24 * 60 * 60;
const NOTE_MAX = 200;

type Parsed = { ok: true; job: JobRequest } | { ok: false; error: string };

function amount(
  value: unknown,
  label: string,
  max: number,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
    return { ok: false, error: `${label} must be a number between 0 and ${max}` };
  }
  return { ok: true, value };
}

export function parseJobRequest(body: unknown): Parsed {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "machineId is required" };
  }
  const input = body as Record<string, unknown>;
  if (typeof input.machineId !== "string" || !input.machineId.trim()) {
    return { ok: false, error: "machineId is required" };
  }
  const grams = amount(input.filamentGrams, "filamentGrams", MAX_GRAMS);
  if (!grams.ok) return grams;
  const prints = amount(input.prints ?? input.sheets, "prints", MAX_PRINTS);
  if (!prints.ok) return prints;
  const runtime = amount(input.runtimeSeconds, "runtimeSeconds", MAX_RUNTIME_SECONDS);
  if (!runtime.ok) return runtime;
  const note =
    typeof input.note === "string" && input.note.trim()
      ? input.note.trim().slice(0, NOTE_MAX)
      : null;
  return {
    ok: true,
    job: {
      machineId: input.machineId.trim(),
      filamentGrams: grams.value,
      prints: prints.value,
      runtimeSeconds: runtime.value,
      note,
    },
  };
}
