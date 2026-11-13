"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import {
  createMockDataProvider,
  type DataProvider,
  type User,
} from "@/lib/data";
import { createRemoteDataProvider, SIGNED_OUT_EVENT } from "@/lib/data/remote-provider";
import { isLiveDataMode } from "@/lib/data/mode";

type DataContextValue = {
  provider: DataProvider;
  currentUser: User | null;
  /** Set when the signed-in user record could not be loaded. */
  userError: string | null;
  /** False while live mode is still resolving the Auth.js session. */
  sessionResolved: boolean;
  refreshUser: () => Promise<void>;
  /** Live mode ignores this and logs a warning. Mock mode switches the fixture user. */
  switchUser: (id: string | null) => Promise<void>;
  clearCurrentUser: () => void;
  revision: number;
  bump: () => void;
};

const DataContext = createContext<DataContextValue | null>(null);

/** Fixture mode only: the Dev toolbar's user, kept for this browser tab. */
const DEV_USER_KEY = "thebox.devUser";

function readDevUser(): string | null {
  try {
    return window.sessionStorage.getItem(DEV_USER_KEY);
  } catch {
    return null;
  }
}

function writeDevUser(id: string | null): void {
  try {
    if (id) window.sessionStorage.setItem(DEV_USER_KEY, id);
    else window.sessionStorage.removeItem(DEV_USER_KEY);
  } catch {
    // Private mode or blocked storage: the choice just lasts until reload.
  }
}

function DataProviders({ children }: { children: ReactNode }) {
  const live = isLiveDataMode();
  const [provider] = useState<DataProvider>(() =>
    isLiveDataMode() ? createRemoteDataProvider() : createMockDataProvider(null),
  );
  const { data: session, status } = useSession();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [sessionResolved, setSessionResolved] = useState(!live);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const clearCurrentUser = useCallback(() => {
    setCurrentUser(null);
    bump();
  }, [bump]);

  // A valid Auth.js session whose email has no member row: sign out instead of
  // bouncing between /login and the member pages.
  const endOrphanedSession = useCallback(async () => {
    setCurrentUser(null);
    await signOut({ redirect: false }).catch(() => undefined);
    window.location.assign("/login?error=NoAccount");
  }, []);

  const refreshUser = useCallback(async () => {
    if (live && status === "loading") return;
    if (live && status !== "authenticated") {
      setCurrentUser(null);
      setUserError(null);
      setSessionResolved(true);
      return;
    }
    try {
      const user = await provider.getCurrentUser();
      if (live && !user) {
        await endOrphanedSession();
        return;
      }
      setCurrentUser(user);
      setUserError(null);
    } catch (err) {
      setCurrentUser(null);
      setUserError(err instanceof Error ? err.message : "Could not load your account");
    } finally {
      setSessionResolved(true);
    }
  }, [live, provider, status, endOrphanedSession]);

  useEffect(() => {
    if (!live) return;
    // Session status arrives after render; the user record is an async RPC.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync Auth.js session to currentUser
    void refreshUser();
  }, [live, status, session?.user?.id, refreshUser]);

  useEffect(() => {
    if (!live || typeof window === "undefined") return;
    const onSignedOut = () => {
      if (status === "authenticated") {
        void endOrphanedSession();
        return;
      }
      setCurrentUser(null);
      bump();
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [live, bump, status, endOrphanedSession]);

  const switchUser = useCallback(
    async (id: string | null) => {
      if (live) {
        console.warn("switchUser is a no-op while NEXT_PUBLIC_DATA_MODE=live");
        return;
      }
      await provider.setCurrentUserId(id);
      writeDevUser(id);
      await refreshUser();
      bump();
    },
    [live, provider, refreshUser, bump],
  );

  // Fixture mode: a full page load starts a new in-browser provider, which
  // would drop the Dev toolbar's user. Pick the same user again.
  useEffect(() => {
    if (live) return;
    const saved = readDevUser();
    if (!saved) return;
    void (async () => {
      await provider.setCurrentUserId(saved);
      await refreshUser();
      bump();
    })();
  }, [live, provider, refreshUser, bump]);

  const value = useMemo(
    () => ({
      provider,
      currentUser,
      userError,
      sessionResolved,
      refreshUser,
      switchUser,
      clearCurrentUser,
      revision,
      bump,
    }),
    [
      provider,
      currentUser,
      userError,
      sessionResolved,
      refreshUser,
      switchUser,
      clearCurrentUser,
      revision,
      bump,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DataProviders>{children}</DataProviders>
    </SessionProvider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within AppProviders");
  return ctx;
}
