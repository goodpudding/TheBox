"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminNotice } from "@/components/admin/admin-notice";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
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
  const [members, setMembers] = useState<User[]>([]);
  /** The class page's own text, loaded with the class. Null until then. */
  const [description, setDescription] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    // "class-generic" is the wording every class without its own text shows.
    // It is not this class's description, so the editor starts empty.
    const page =
      cls && cls.descriptionSlug !== "class-generic"
        ? await provider.getContentBySlug(cls.descriptionSlug)
        : null;
    setDescription(page?.html ?? "");
    setMembers(members);
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
    setMessage(null);
    await provider.adminUpsertClass({ ...data, id });
    setMessage("Class saved.");
    bump();
  }

  async function runAction(
    key: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    if (!currentUser) return;
    setBusyId(key);
    setActionError(null);
    setMessage(null);
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
  const holdingSeat = roster.filter((r) =>
    ["booked", "awaiting_payment"].includes(r.status),
  ).length;
  const onRoster = new Set(
    roster
      .filter((r) => !["cancelled", "expired", "no_show"].includes(r.status))
      .map((r) => r.userId),
  );
  const addable = members
    .filter((m) => !onRoster.has(m.id) && m.status !== "suspended")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

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
      <Link
        href={`/classes/${id}`}
        className="ml-6 font-display text-sm font-semibold text-primary-text hover:underline"
      >
        View the public page →
      </Link>

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold text-brown">
          Details
        </h2>
        <div className="mt-5">
          <AdminNotice message={message} error={null} />
          <ClassForm
            initial={session}
            initialDescription={description ?? ""}
            staff={staff}
            certifications={certs}
            submitLabel="Save changes"
            onSubmit={onSave}
          />
        </div>
      </div>

      <section className="mt-14 max-w-xl">
        <h2 className="font-display text-xl font-semibold text-brown">
          {session.cancelledAt ? "This class is cancelled" : "Cancel this class"}
        </h2>
        {session.cancelledAt ? (
          <>
            <p className="mt-3 text-sm text-charcoal">
              Cancelled {formatDateTime(session.cancelledAt)}. It is off the
              public calendar and cannot be booked.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={busyId === "restore"}
              onClick={() =>
                runAction("restore", () => provider.adminRestoreClass(id))
              }
            >
              {busyId === "restore" ? "Restoring…" : "Restore this class"}
            </Button>
          </>
        ) : confirmingCancel ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-4 text-sm text-brown">
            <p>
              {holdingSeat === 0
                ? "Nobody is booked."
                : `${holdingSeat} ${holdingSeat === 1 ? "person is" : "people are"} booked`}
              {holdingSeat > 0 && waitlisted > 0
                ? ` and ${waitlisted} on the waitlist.`
                : holdingSeat > 0
                  ? "."
                  : waitlisted > 0
                    ? ` ${waitlisted} on the waitlist.`
                    : ""}{" "}
              Nobody is told automatically, so contact them yourself.
            </p>
            <p>
              Cancelling moves no money. Refund a Zeffy payment in Zeffy. Their
              bookings stay on the roster below; cancel one there to give back
              credits it was paid with.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={busyId === "cancel-class"}
                onClick={() =>
                  runAction("cancel-class", async () => {
                    await provider.adminCancelClass(id);
                    setConfirmingCancel(false);
                  })
                }
              >
                {busyId === "cancel-class" ? "Cancelling…" : "Yes, cancel the class"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingCancel(false)}
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-secondary">
              Takes it off the public calendar. The hourly Zeffy sync will not
              put it back.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel this class
            </Button>
          </>
        )}
      </section>

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

        {session.cancelledAt ? null : (
          <div className="mt-5 max-w-xl space-y-2">
            <Label htmlFor="add-booking">Add someone to this class</Label>
            <div className="flex flex-wrap gap-3">
              <select
                id="add-booking"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-charcoal"
              >
                <option value="">Choose a member…</option>
                {addable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.email})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                disabled={!addUserId || busyId === "add-booking"}
                onClick={() =>
                  runAction("add-booking", async () => {
                    await provider.adminAddBooking(id, addUserId);
                    setAddUserId("");
                  })
                }
              >
                {busyId === "add-booking" ? "Adding…" : "Add"}
              </Button>
            </div>
            <p className="text-xs text-secondary">
              {session.priceCents > 0
                ? "This is a paid class: the seat is held for payment. Use Mark paid once they have paid. Nothing is charged here."
                : "This class is free, so they are booked straight away."}{" "}
              A full class puts them on the waitlist.
            </p>
          </div>
        )}
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
                  {["booked", "awaiting_payment", "waitlisted"].includes(
                    row.status,
                  ) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === `cancel-${row.id}`}
                      aria-label={`Cancel ${row.user.displayName}’s booking`}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Cancel ${row.user.displayName}’s booking? Credits they paid with are returned. A Zeffy payment is refunded in Zeffy, not here.`,
                          )
                        ) {
                          return;
                        }
                        void runAction(`cancel-${row.id}`, () =>
                          provider.adminCancelBooking(row.id),
                        );
                      }}
                    >
                      Cancel booking
                    </Button>
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
