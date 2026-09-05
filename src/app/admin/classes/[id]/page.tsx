"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { ClassForm } from "@/app/admin/classes/class-form";
import type {
  BookingRosterRow,
  Certification,
  ClassSessionInput,
  ClassSessionView,
  User,
} from "@/lib/data";

function rosterTone(
  status: string,
): "ok" | "warn" | "info" | "muted" | "danger" {
  if (status === "booked" || status === "attended") return "ok";
  if (status === "awaiting_payment") return "warn";
  if (status === "waitlisted") return "info";
  if (status === "no_show") return "danger";
  return "muted";
}

export default function AdminClassDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { provider, currentUser, revision, bump } = useData();

  const [session, setSession] = useState<ClassSessionView | null | undefined>(
    undefined,
  );
  const [roster, setRoster] = useState<BookingRosterRow[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const [cls, rows, members, certifications] = await Promise.all([
      provider.getClass(id),
      provider.adminListRoster(id),
      provider.adminListMembers(),
      provider.listCertifications(),
    ]);
    setSession(cls);
    setRoster(
      [...rows].sort((a, b) => {
        if (a.status === "waitlisted" && b.status === "waitlisted") {
          return (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0);
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    );
    setStaff(members.filter((u) => u.role === "staff" || u.role === "admin"));
    setCerts(certifications);
  }, [id, provider]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, revision]);

  async function onSave(data: ClassSessionInput) {
    await provider.adminUpsertClass({ ...data, id });
    bump();
  }

  async function runAction(
    key: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    if (!currentUser) return;
    setBusyId(key);
    setActionError(null);
    try {
      await fn();
      bump();
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (session === undefined) {
    return (
      <AdminShell title="Class">
        <p className="text-secondary">Loading…</p>
      </AdminShell>
    );
  }

  if (!session) {
    return (
      <AdminShell title="Class not found">
        <p className="text-secondary">No class with that id.</p>
        <Link
          href="/admin/classes"
          className="mt-4 inline-block font-display text-sm font-semibold text-primary-text hover:underline"
        >
          ← Back to classes
        </Link>
      </AdminShell>
    );
  }

  const waitlisted = roster.filter((r) => r.status === "waitlisted").length;

  return (
    <AdminShell
      title={session.title}
      description="Edit session details and manage the roster."
    >
      <Link
        href="/admin/classes"
        className="font-display text-sm font-semibold text-primary-text hover:underline"
      >
        ← All classes
      </Link>

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold text-brown">
          Details
        </h2>
        <div className="mt-5">
          <ClassForm
            initial={session}
            staff={staff}
            certifications={certs}
            submitLabel="Save changes"
            onSubmit={onSave}
          />
        </div>
      </div>

      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-brown">
            Roster
          </h2>
          {waitlisted > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!currentUser || busyId === "promote"}
              onClick={() =>
                runAction("promote", () =>
                  provider.adminPromoteFromWaitlist(id, currentUser!.id),
                )
              }
            >
              {busyId === "promote" ? "Promoting…" : "Promote waitlist"}
            </Button>
          ) : null}
        </div>

        {actionError ? (
          <p className="mt-3 text-sm text-brown" role="alert">
            {actionError}
          </p>
        ) : null}

        {roster.length === 0 ? (
          <p className="mt-4 text-secondary">No bookings yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {roster.map((row) => (
              <li key={row.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold text-brown">
                      {row.user.displayName}
                    </p>
                    <p className="text-sm text-secondary">{row.user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={rosterTone(row.status)}>
                      {row.status.replace(/_/g, " ")}
                    </StatusPill>
                    {row.status === "waitlisted" && row.waitlistPosition ? (
                      <StatusPill tone="info">
                        Waitlist #{row.waitlistPosition}
                      </StatusPill>
                    ) : null}
                  </div>
                </div>

                {row.status === "awaiting_payment" ? (
                  <p className="mt-2 text-sm text-secondary">
                    Reminder: complete payment via Zeffy
                    {session.zeffyUrl ? (
                      <>
                        {" — "}
                        <a
                          href={session.zeffyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary-text hover:underline"
                        >
                          open payment link
                        </a>
                      </>
                    ) : (
                      " (no Zeffy URL set on this class)."
                    )}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status === "awaiting_payment" ||
                  row.status === "waitlisted" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!currentUser || busyId === `paid-${row.id}`}
                      onClick={() =>
                        runAction(`paid-${row.id}`, () =>
                          provider.adminMarkBookingPaid(row.id, currentUser!.id),
                        )
                      }
                    >
                      Mark paid
                    </Button>
                  ) : null}
                  {row.status === "booked" ||
                  row.status === "awaiting_payment" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          !currentUser || busyId === `attended-${row.id}`
                        }
                        onClick={() =>
                          runAction(`attended-${row.id}`, () =>
                            provider.adminMarkAttendance(
                              row.id,
                              "attended",
                              currentUser!.id,
                            ),
                          )
                        }
                      >
                        Mark attended
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          !currentUser || busyId === `noshow-${row.id}`
                        }
                        onClick={() =>
                          runAction(`noshow-${row.id}`, () =>
                            provider.adminMarkAttendance(
                              row.id,
                              "no_show",
                              currentUser!.id,
                            ),
                          )
                        }
                      >
                        No-show
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
