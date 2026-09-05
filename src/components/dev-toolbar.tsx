"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/providers";
import type { User } from "@/lib/data";

export function DevToolbar() {
  const { provider, currentUser, switchUser, revision } = useData();
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    void provider.listSwitchableUsers().then(setUsers);
  }, [provider, revision]);

  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-brown/30 bg-brown text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
        >
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "Demo" : "Dev"} ·
          Switch user {open ? "▾" : "▸"}
        </button>

        {open ? (
          <>
            <select
              className="min-w-[220px] flex-1 rounded-full border border-white/20 bg-footer px-3 py-1.5 font-display text-sm text-white"
              value={currentUser?.id ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                void switchUser(v === "" ? null : v);
              }}
            >
              <option value="">Guest (logged out)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} · {u.role}
                  {u._notes ? ` · ${u._notes.slice(0, 40)}` : ""}
                </option>
              ))}
            </select>
            <span className="font-display text-xs text-white/60 hidden sm:inline">
              {process.env.NEXT_PUBLIC_DEMO_MODE === "true"
                ? "Demo · mock data only"
                : "Mock data · session writes only"}
            </span>
            <a
              href={`/display?token=${encodeURIComponent(
                process.env.NEXT_PUBLIC_DISPLAY_TOKEN?.trim() ||
                  "dev-display-token-change-me",
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/25 px-3 py-1.5 font-display text-xs font-semibold text-white hover:bg-white/10"
            >
              Lobby display
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
