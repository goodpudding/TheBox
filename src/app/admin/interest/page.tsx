"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ClassInterestBoardView,
  ClassInterestSignup,
  ClassInterestStatus,
} from "@/lib/data";

const TABS: { id: ClassInterestStatus | "all"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "ready", label: "Ready" },
  { id: "open", label: "Open" },
  { id: "expired", label: "Expired" },
  { id: "scheduled", label: "Scheduled" },
  { id: "all", label: "All" },
];

export default function AdminInterestPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [tab, setTab] = useState<ClassInterestStatus | "all">("pending");
  const [boards, setBoards] = useState<ClassInterestBoardView[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [signups, setSignups] = useState<ClassInterestSignup[]>([]);
  const [thresholdEdit, setThresholdEdit] = useState<Record<string, string>>(
    {},
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await provider.listInterestBoards(
        tab === "all" ? undefined : { status: tab },
      );
      if (!cancelled) setBoards(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision, tab]);

  useEffect(() => {
    if (!expandedId) {
      setSignups([]);
      return;
    }
    let cancelled = false;
    void provider.listInterestSignups(expandedId).then((rows) => {
      if (!cancelled) setSignups(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, expandedId, revision]);

  const counts = useMemo(() => {
    return {
      pending: boards.filter((b) => b.status === "pending").length,
      ready: boards.filter((b) => b.status === "ready").length,
    };
  }, [boards]);

  async function approve(board: ClassInterestBoardView) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    try {
      const threshold = Number(
        thresholdEdit[board.id] ?? board.threshold,
      );
      await provider.adminApproveInterestBoard(board.id, currentUser.id, {
        threshold: Number.isFinite(threshold) ? threshold : board.threshold,
      });
      bump();
      setMessage(`Approved “${board.title}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setPending(false);
    }
  }

  async function reject(board: ClassInterestBoardView) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    try {
      await provider.adminRejectInterestBoard(
        board.id,
        currentUser.id,
        "Not scheduling this round",
      );
      bump();
      setMessage(`Rejected “${board.title}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Class interest"
      description="Review proposals, watch thresholds, and schedule classes with first-dibs for the interest list."
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 font-display text-sm font-medium ${
              tab === t.id
                ? "bg-primary/15 text-primary-text"
                : "text-secondary hover:text-charcoal"
            }`}
          >
            {t.label}
            {t.id === "pending" && counts.pending
              ? ` (${counts.pending})`
              : ""}
            {t.id === "ready" && tab === "all" && counts.ready
              ? ` (${counts.ready})`
              : ""}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 text-sm text-primary-text">{message}</p>
      ) : null}

      <ul className="mt-10 space-y-8">
        {boards.length === 0 ? (
          <li className="text-secondary">Nothing in this queue.</li>
        ) : (
          boards.map((board) => (
            <li key={board.id} className="border-b border-border pb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-charcoal">
                    {board.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-secondary">
                    {board.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone="info">{board.status}</StatusPill>
                    <StatusPill tone="muted">
                      {board.interestCount}/{board.threshold}
                    </StatusPill>
                    <StatusPill tone="muted">
                      {board.contactName} · {board.contactEmail}
                    </StatusPill>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {board.status === "pending" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`th-${board.id}`}
                          className="sr-only"
                        >
                          Threshold
                        </Label>
                        <Input
                          id={`th-${board.id}`}
                          className="w-20"
                          type="number"
                          min={3}
                          value={
                            thresholdEdit[board.id] ?? String(board.threshold)
                          }
                          onChange={(e) =>
                            setThresholdEdit((prev) => ({
                              ...prev,
                              [board.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => void approve(board)}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void reject(board)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {board.status === "ready" || board.status === "open" ? (
                    <Button asChild>
                      <Link
                        href={`/admin/classes/new?interestBoardId=${board.id}`}
                      >
                        Schedule class
                      </Link>
                    </Button>
                  ) : null}
                  {board.scheduledClassSessionId ? (
                    <Button asChild variant="outline">
                      <Link
                        href={`/admin/classes/${board.scheduledClassSessionId}`}
                      >
                        View class
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setExpandedId((id) =>
                        id === board.id ? null : board.id,
                      )
                    }
                  >
                    {expandedId === board.id ? "Hide list" : "Interest list"}
                  </Button>
                </div>
              </div>
              {expandedId === board.id ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-secondary">
                        <th className="py-2 pr-4 font-display font-medium">
                          #
                        </th>
                        <th className="py-2 pr-4 font-display font-medium">
                          Name
                        </th>
                        <th className="py-2 pr-4 font-display font-medium">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {signups.map((s, i) => (
                        <tr key={s.id} className="border-t border-border">
                          <td className="py-2 pr-4">{i + 1}</td>
                          <td className="py-2 pr-4">{s.displayName}</td>
                          <td className="py-2 pr-4">
                            <a
                              href={`mailto:${s.email}`}
                              className="text-primary-text hover:underline"
                            >
                              {s.email}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {signups.length === 0 ? (
                    <p className="mt-2 text-sm text-secondary">No signups yet.</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </AdminShell>
  );
}
