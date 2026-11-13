export type IdleLimits = {
  idleLockMinutes: number;
  idleLogoutMinutes: number;
};

/** What the kiosk should do after `idleMs` without a tap or a key press. */
export function idleAction(
  idleMs: number,
  limits: IdleLimits,
): "lock" | "logout" | null {
  if (idleMs >= limits.idleLogoutMinutes * 60_000) return "logout";
  if (idleMs >= limits.idleLockMinutes * 60_000) return "lock";
  return null;
}
