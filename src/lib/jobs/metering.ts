/**
 * Pure metering math for Shelly power samples. See docs/machine-billing-spec.md §2.
 * Samples are { atMs, watts }, sorted ascending. No I/O here.
 */
export interface MeterSample {
  atMs: number;
  watts: number;
}

export interface MeterProfile {
  idleWatts: number;
  activeWatts: number;
  minEventSeconds: number;
}

export interface MeterSummary {
  activeSeconds: number;
  events: number;
  lastActiveAtMs: number | null;
}

export function summarizeSamples(
  samples: MeterSample[],
  profile: MeterProfile,
): MeterSummary {
  let activeSeconds = 0;
  let events = 0;
  let lastActiveAtMs: number | null = null;
  let runStartMs: number | null = null;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const next = samples[i + 1];
    const spanSec = next ? Math.max(0, (next.atMs - s.atMs) / 1000) : 0;
    const active = s.watts > profile.activeWatts;
    if (active) {
      activeSeconds += spanSec;
      lastActiveAtMs = s.atMs;
      if (runStartMs == null) runStartMs = s.atMs;
    } else if (runStartMs != null) {
      if ((s.atMs - runStartMs) / 1000 >= profile.minEventSeconds) events++;
      runStartMs = null;
    }
  }
  if (runStartMs != null && lastActiveAtMs != null) {
    if ((lastActiveAtMs - runStartMs) / 1000 >= profile.minEventSeconds) events++;
  }
  return { activeSeconds, events, lastActiveAtMs };
}

/** True when the tool has been at/below idle for `idleForSeconds` ending at the last sample. */
export function isIdleFor(
  samples: MeterSample[],
  profile: MeterProfile,
  idleForSeconds: number,
): boolean {
  if (samples.length === 0) return false;
  const endMs = samples[samples.length - 1].atMs;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (s.watts >= profile.idleWatts) return false;
    if ((endMs - s.atMs) / 1000 >= idleForSeconds) return true;
  }
  return false;
}

/** Extra minutes to bill after a job: over estimate by more than 10% + 5 min. */
export function overrunMinutes(
  estMinutes: number,
  activeSeconds: number,
  roundingMinutes = 5,
): number {
  const activeMin = activeSeconds / 60;
  const allowance = estMinutes * 1.1 + 5;
  if (activeMin <= allowance) return 0;
  const over = activeMin - estMinutes;
  return Math.ceil(over / roundingMinutes) * roundingMinutes;
}
