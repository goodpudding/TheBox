"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminNotice } from "@/components/admin/admin-notice";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { Bounty } from "@/lib/data";

const STATUS_LABEL: Record<Bounty["status"], string> = {
  open: "Open",
  claimed: "Claimed",
  completed: "Completed",
};

export default function AdminBountiesPage() {
  const { provider, revision, bump } = useData();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    description: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.adminListBounties().then((list) => {
      if (!cancelled) setBounties(list);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  async function run(id: string, done: string, action: () => Promise<unknown>) {
    setPendingId(id);
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(done);
      bump();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setPendingId(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const ok = await run(editing.id, "Request updated.", () =>
      provider.adminUpdateBounty(editing.id, {
        title: editing.title,
        description: editing.description,
      }),
    );
    if (ok) setEditing(null);
  }

  return (
    <AdminShell
      title="Bounties"
      description="Requests on the public bounty board. Fix the wording, hide one while you check it, reopen one that stalled, or remove spam."
    >
      <AdminNotice message={message} error={error} />

      {bounties.length === 0 ? (
        <p className="text-secondary">No requests yet.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {bounties.map((b) => {
            const hidden = Boolean(b.deletedAt);
            const busy = pendingId === b.id;
            return (
              <li key={b.id} className="py-5">
                {editing?.id === b.id ? (
                  <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`bounty-title-${b.id}`}>Title</Label>
                      <Input
                        id={`bounty-title-${b.id}`}
                        required
                        value={editing.title}
                        onChange={(e) =>
                          setEditing({ ...editing, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`bounty-description-${b.id}`}>Description</Label>
                      <Textarea
                        id={`bounty-description-${b.id}`}
                        rows={5}
                        required
                        value={editing.description}
                        onChange={(e) =>
                          setEditing({ ...editing, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" size="sm" disabled={busy}>
                        {busy ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold text-brown">
                          {b.title}
                        </p>
                        <p className="mt-1 text-sm text-secondary">
                          {b.requesterName}
                          {b.businessName ? ` · ${b.businessName}` : ""} ·{" "}
                          <a
                            href={`mailto:${b.requesterEmail}`}
                            className="text-primary-text underline-offset-2 hover:underline"
                          >
                            {b.requesterEmail}
                          </a>{" "}
                          · {formatDateTime(b.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill tone={b.status === "open" ? "ok" : "info"}>
                          {STATUS_LABEL[b.status]}
                        </StatusPill>
                        {hidden ? <StatusPill tone="muted">Hidden</StatusPill> : null}
                      </div>
                    </div>
                    <p className="mt-3 max-w-2xl whitespace-pre-line text-charcoal">
                      {b.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Edit ${b.title}`}
                        onClick={() =>
                          setEditing({
                            id: b.id,
                            title: b.title,
                            description: b.description,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`${hidden ? "Show" : "Hide"} ${b.title}`}
                        onClick={() =>
                          void run(
                            b.id,
                            hidden
                              ? "Request is back on the board."
                              : "Request hidden from the board.",
                            () => provider.adminUpdateBounty(b.id, { hidden: !hidden }),
                          )
                        }
                      >
                        {hidden ? "Show on the board" : "Hide"}
                      </Button>
                      {b.status !== "open" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          aria-label={`Reopen ${b.title}`}
                          onClick={() =>
                            void run(b.id, "Request reopened.", () =>
                              provider.adminUpdateBounty(b.id, { reopen: true }),
                            )
                          }
                        >
                          Reopen
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Remove ${b.title}`}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove “${b.title}” for good? Use Hide to take it down and keep it.`,
                            )
                          ) {
                            return;
                          }
                          void run(b.id, "Request removed.", () =>
                            provider.adminDeleteBounty(b.id),
                          );
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
