import { useSyncExternalStore } from "react";
import type { Now } from "./time-window";

/** How often "happening now" style labels re-check the clock. */
export const NOW_TICK_MS = 30_000;

/**
 * The time, rounded down to the last tick. Every read within a tick returns
 * the same number, which is what lets React treat the clock as a store.
 */
export function readNow(): number {
  return Math.floor(Date.now() / NOW_TICK_MS) * NOW_TICK_MS;
}

/** Calls `onTick` each time `readNow` moves on. Returns the unsubscribe. */
export function subscribeToNow(onTick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const waitForNextTick = () => {
    timer = setTimeout(
      () => {
        onTick();
        waitForNextTick();
      },
      NOW_TICK_MS - (Date.now() % NOW_TICK_MS),
    );
  };
  waitForNextTick();
  return () => clearTimeout(timer);
}

const unknownOnServer = () => null;

/**
 * The current time for use while rendering. Reading the clock directly in a
 * component makes its output depend on when it happened to render; this keeps
 * render pure and re-renders the component as time passes, so a "happening
 * now" label turns on and off by itself. Null during server render and
 * hydration, so both produce the same HTML.
 */
export function useNow(): Now {
  return useSyncExternalStore(subscribeToNow, readNow, unknownOnServer);
}
