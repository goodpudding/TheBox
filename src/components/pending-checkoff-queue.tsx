"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { PendingCheckoff } from "@/lib/data";

type Props = {
  /** Where the member profile link should point; omit to hide profile links. */
  memberHref?: (userId: string) => string;
  /** Show inline checkoff when the viewer can act. */
  allowInlineCheckoff?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function PendingCheckoffQueue({
  memberHref,
  allowInlineCheckoff = true,
  emptyMessage = "No members waiting on hands-on checkoff.",
  className,
}: Props) {
  const { provider, currentUser, revision, bump } = useData();
  const [rows, setRows] = useState<PendingCheckoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setLoading(true);
    void provider.listPendingCheckoffs(currentUser.id).then((list) => {
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision, currentUser]);

  async function checkOff(row: PendingCheckoff) {
    if (!currentUser) return;
    const key = `${row.userId}:${row.certificationId}`;
    setBusyKey(key);
    setError(null);
    try {
      await provider.recordCheckoff({
        userId: row.userId,
        certificationId: row.certificationId,
        actorId: currentUser.id,
      });
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkoff failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (!currentUser) return null;

  return (
    <div className={className}>
      {loading ? (
        <p className="text-secondary">Loading checkoff queue…</p>
      ) : rows.length === 0 ? (
        <p className="text-secondary">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => {
            const key = `${row.userId}:${row.certificationId}`;
            const profileHref = memberHref?.(row.userId);
            return (
              <li
                key={key}
                className="flex flex-wrap items-start justify-between gap-3 py-4"
              >
                <div className="max-w-xl">
                  <p className="font-display text-base font-semibold text-brown">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="hover:text-primary-text"
                      >
                        {row.userDisplayName}
                      </Link>
                    ) : (
                      row.userDisplayName
                    )}
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    {row.certificationName}
                    {row.machineNames.length > 0
                      ? ` · ${row.machineNames.join(", ")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    Knowledge passed {formatDateTime(row.knowledgePassedAt)}
                    {row.championDisplayNames.length > 0
                      ? ` · Champions: ${row.championDisplayNames.join(", ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profileHref ? (
                    <Button asChild variant="secondary">
                      <Link href={profileHref}>Open profile</Link>
                    </Button>
                  ) : null}
                  {allowInlineCheckoff && row.canCheckoff ? (
                    <Button
                      type="button"
                      disabled={busyKey === key}
                      onClick={() => void checkOff(row)}
                    >
                      {busyKey === key ? "Saving…" : "Record checkoff"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p className="mt-3 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
