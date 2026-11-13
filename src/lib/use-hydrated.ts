import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};

/**
 * False on the server and while the page hydrates, true from then on. Lets a
 * component hold back anything only the browser knows (storage, the window)
 * until showing it can no longer disagree with the server's HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}
