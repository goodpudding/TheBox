"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SessionProvider } from "next-auth/react";
import {
  createMockDataProvider,
  type DataProvider,
  type User,
} from "@/lib/data";

type DataContextValue = {
  provider: DataProvider;
  currentUser: User | null;
  refreshUser: () => Promise<void>;
  switchUser: (id: string | null) => Promise<void>;
  revision: number;
  bump: () => void;
};

const DataContext = createContext<DataContextValue | null>(null);

function DataProviders({ children }: { children: ReactNode }) {
  const providerRef = useRef<DataProvider | null>(null);
  if (!providerRef.current) {
    providerRef.current = createMockDataProvider(null);
  }
  const provider = providerRef.current;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const refreshUser = useCallback(async () => {
    const user = await provider.getCurrentUser();
    setCurrentUser(user);
  }, [provider]);

  const switchUser = useCallback(
    async (id: string | null) => {
      await provider.setCurrentUserId(id);
      await refreshUser();
      bump();
    },
    [provider, refreshUser, bump],
  );

  const value = useMemo(
    () => ({
      provider,
      currentUser,
      refreshUser,
      switchUser,
      revision,
      bump,
    }),
    [provider, currentUser, refreshUser, switchUser, revision, bump],
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
