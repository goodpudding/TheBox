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
import { SessionProvider, useSession } from "next-auth/react";
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

function DataProviders({ children }: { children: ReactNode }) {
  const live = isLiveDataMode();
  const [provider] = useState<DataProvider>(() =>
    isLiveDataMode() ? createRemoteDataProvider() : createMockDataProvider(null),
  );
  const { data: session, status } = useSession();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionResolved, setSessionResolved] = useState(!live);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const clearCurrentUser = useCallback(() => {
    setCurrentUser(null);
    bump();
  }, [bump]);

  const refreshUser = useCallback(async () => {
    if (live && status === "loading") return;
    if (live && status !== "authenticated") {
      setCurrentUser(null);
      setSessionResolved(true);
      return;
    }
    try {
      const user = await provider.getCurrentUser();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    } finally {
      setSessionResolved(true);
    }
  }, [live, provider, status]);

  useEffect(() => {
    if (!live) return;
    // Session status arrives after render; the user record is an async RPC.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync Auth.js session to currentUser
    void refreshUser();
  }, [live, status, session?.user?.id, refreshUser]);

  useEffect(() => {
    if (!live || typeof window === "undefined") return;
    const onSignedOut = () => {
      setCurrentUser(null);
      bump();
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [live, bump]);

  const switchUser = useCallback(
    async (id: string | null) => {
      if (live) {
        console.warn("switchUser is a no-op while NEXT_PUBLIC_DATA_MODE=live");
        return;
      }
      await provider.setCurrentUserId(id);
      await refreshUser();
      bump();
    },
    [live, provider, refreshUser, bump],
  );

  const value = useMemo(
    () => ({
      provider,
      currentUser,
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
