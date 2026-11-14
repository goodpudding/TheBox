import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;
const noHashOnServer = () => "";

/**
 * The fragment of the address, such as "#request". Empty on the server and
 * while the page hydrates, so both produce the same HTML; the real value
 * arrives right after.
 */
export function useLocationHash(): string {
  return useSyncExternalStore(subscribe, readHash, noHashOnServer);
}
