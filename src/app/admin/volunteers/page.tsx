"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type {
  VolunteerInterest,
  VolunteerInterestStatus,
  VolunteerRole,
} from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const STATUSES: VolunteerInterestStatus[] = [
  "new",
  "contacted",
  "accepted",
  "declined",
  "archived",
];

export default function AdminVolunteersPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [interests, setInterests] = useState<VolunteerInterest[]>([]);
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [statusDraft, setStatusDraft] = useState<
    Record<string, VolunteerInterestStatus>
  >({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const roleTitle = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.title]));
    return (roleId?: string | null) =>
      roleId ? (map.get(roleId) ?? roleId) : "General interest";
  }, [roles]);

  useEffect(() => {
    void (async () => {
      const [list, roleList] = await Promise.all([
        provider.adminListVolunteerInterests(),
        provider.listVolunteerRoles(),
      ]);
      setInterests(list);
      setRoles(roleList);
      const notes: Record<string, string> = {};
      const statuses: Record<string, VolunteerInterestStatus> = {};
      for (const row of list) {
        notes[row.id] = row.notes ?? "";
        statuses[row.id] = row.status;
      }
      setNotesDraft(notes);
      setStatusDraft(statuses);
    })();
  }, [provider, revision]);

  async function save(id: string) {
    if (!currentUser) return;
    setPendingId(id);
    setError(null);
    setMessage(null);
    try {
      await provider.adminUpdateVolunteerInterest(id, {
        status: statusDraft[id],
        notes: notesDraft[id] ?? "",
        reviewedById: currentUser.id,
      });
      bump();
      setMessage("Interest updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AdminShell
      title="Volunteer interests"
      description="Follow up on Shop Steward and other role applications."
    >
      {error ? (
        <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-brown">
          {message}
        </p>
      ) : null}

      <ul className="space-y-8">
        {interests.map((row) => (
          <li
            key={row.id}
            className="border-b border-border pb-8 last:border-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-brown">
                  {row.name}
                </p>
                <p className="mt-1 text-sm text-secondary">
                  {row.email}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
                <p className="mt-1 text-sm text-secondary">
                  {roleTitle(row.roleId)} · submitted{" "}
                  {formatDateTime(row.createdAt)}
                </p>
              </div>
              <StatusPill
                tone={
                  row.status === "accepted"
                    ? "ok"
                    : row.status === "new"
                      ? "info"
                      : "muted"
                }
              >
                {row.status}
              </StatusPill>
            </div>
            {row.message ? (
              <p className="mt-3 max-w-2xl text-secondary leading-relaxed">
                {row.message}
              </p>
            ) : null}

            <div className="mt-4 grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor={`status-${row.id}`}>Status</Label>
                <select
                  id={`status-${row.id}`}
                  className={selectClass}
                  value={statusDraft[row.id] ?? row.status}
                  onChange={(e) =>
                    setStatusDraft((prev) => ({
                      ...prev,
                      [row.id]: e.target.value as VolunteerInterestStatus,
                    }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`notes-${row.id}`}>Staff notes</Label>
                <Textarea
                  id={`notes-${row.id}`}
                  value={notesDraft[row.id] ?? ""}
                  onChange={(e) =>
                    setNotesDraft((prev) => ({
                      ...prev,
                      [row.id]: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={pendingId === row.id}
                onClick={() => void save(row.id)}
              >
                {pendingId === row.id ? "Saving…" : "Save"}
              </Button>
            </div>
          </li>
        ))}
        {interests.length === 0 ? (
          <li className="text-secondary">No volunteer interests yet.</li>
        ) : null}
      </ul>
    </AdminShell>
  );
}
