type TauriGlobals = {
  __TAURI__?: { core?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } };
  __TAURI_INTERNALS__?: {
    invoke: (cmd: string, args?: unknown) => Promise<unknown>;
  };
};

export function isTauriShell(): boolean {
  if (typeof window === "undefined") return false;
  const g = window as unknown as TauriGlobals;
  return Boolean(g.__TAURI__?.core?.invoke || g.__TAURI_INTERNALS__?.invoke);
}

export async function nativeInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const g = window as unknown as TauriGlobals;
  try {
    if (g.__TAURI__?.core?.invoke) {
      return (await g.__TAURI__.core.invoke(cmd, args)) as T;
    }
    if (g.__TAURI_INTERNALS__?.invoke) {
      return (await g.__TAURI_INTERNALS__.invoke(cmd, args)) as T;
    }
  } catch {
    return null;
  }
  return null;
}
