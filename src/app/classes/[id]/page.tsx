"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { formatMoney, formatMoneyExact } from "@/lib/utils";
import { classCreditsShortfallMessage } from "@/lib/credits";
import type {
  Certification,
  ClassCategory,
  ClassInterestBoardView,
  ClassSessionView,
  ContentPage,
  CreditWallet,
} from "@/lib/data";

const CATEGORY_LABEL: Record<ClassCategory, string> = {
  orientation: "Orientation",
  certification_checkoff: "Certification checkoff",
  workshop: "Workshop",
  open_studio: "Open studio",
};

const ACTIVE_BOOKING = new Set([
  "booked",
  "awaiting_payment",
  "waitlisted",
]);

function bookingLabel(status: string, waitlistPosition?: number | null) {
  if (status === "waitlisted") {
    return waitlistPosition
      ? `Waitlisted (#${waitlistPosition})`
      : "Waitlisted";
  }
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "booked") return "Booked";
  return status.replace(/_/g, " ");
}

function bookingTone(
  status: string,
): "ok" | "warn" | "info" | "muted" | "danger" {
  if (status === "booked") return "ok";
  if (status === "awaiting_payment") return "warn";
  if (status === "waitlisted") return "info";
  return "muted";
}

export default function ClassDetailPage() {
  return (
    <MemberGate>
      <ClassDetailBody />
    </MemberGate>
  );
}

function ClassDetailBody() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { provider, currentUser, revision, bump } = useData();
  const [session, setSession] = useState<ClassSessionView | null | undefined>(
    undefined,
  );
  const [description, setDescription] = useState<ContentPage | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [interestBoard, setInterestBoard] =
    useState<ClassInterestBoardView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [s, certList, boards, creditWallet] = await Promise.all([
          provider.getClass(id),
          provider.listCertifications(),
          provider.listInterestBoards({ status: "scheduled" }),
          currentUser
            ? provider.getCreditWallet(currentUser.id)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSession(s);
        setCerts(certList);
        setWallet(creditWallet);
        setInterestBoard(
          boards.find((b) => b.scheduledClassSessionId === id) ?? null,
        );
        if (s?.descriptionSlug) {
          const page = await provider.getContentBySlug(s.descriptionSlug);
          if (!cancelled) setDescription(page);
        } else {
          setDescription(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSession(null);
          setError(e instanceof Error ? e.message : "Failed to load class");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, provider, revision, currentUser]);

  if (!currentUser) return null;

  if (session === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading class…</p>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <PageHero eyebrow="Classes" title="Class not found" />
        <p className="mt-6 text-secondary">
          That session may have been unpublished or the link is wrong.
        </p>
        <p className="mt-6">
          <Link
            href="/classes"
            className="font-display text-sm font-semibold text-primary-text hover:underline"
          >
            ← Back to classes
          </Link>
        </p>
      </PageShell>
    );
  }

  const booking = session.currentUserBooking;
  const hasActive =
    booking != null && ACTIVE_BOOKING.has(booking.status);
  const prereqNames = session.prerequisiteCertificationIds.map((cid) => {
    const cert = certs.find((c) => c.id === cid);
    return cert?.name ?? cid;
  });
  const price =
    session.priceCents <= 0 ? "Free" : formatMoney(session.priceCents);
  const priorityActive =
    interestBoard?.priorityBookingEndsAt != null &&
    new Date(interestBoard.priorityBookingEndsAt).getTime() > Date.now();

  async function onBook() {
    if (!currentUser || !session) return;
    const classId = session.id;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await provider.book(classId, currentUser.id);
      bump();
      if (result.status === "booked") {
        setMessage("You’re booked. See you in the shop.");
      } else if (result.status === "awaiting_payment") {
        setMessage(
          "Seat held — complete payment via Zeffy. Staff marks you paid once the donation clears; unpaid holds expire.",
        );
      } else if (result.status === "waitlisted") {
        setMessage(
          result.waitlistPosition
            ? `Added to the waitlist at position ${result.waitlistPosition}.`
            : "Added to the waitlist.",
        );
      } else {
        setMessage(`Booking status: ${result.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPayWithCredits() {
    if (!currentUser || !booking) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await provider.payBookingWithCredits(booking.id, currentUser.id);
      bump();
      setMessage("Paid with machine credits. You’re booked.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pay with credits");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!currentUser || !booking) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await provider.cancel(booking.id, currentUser.id);
      bump();
      setMessage("Booking cancelled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <p className="mb-6">
        <Link
          href="/classes"
          className="font-display text-sm font-semibold text-primary-text hover:underline"
        >
          ← All classes
        </Link>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHero
          eyebrow={CATEGORY_LABEL[session.category]}
          title={session.title}
          description={`${formatDateTime(session.startsAt)} · ${session.location}`}
        />
        <StatusPill tone="muted">{price}</StatusPill>
      </div>

      {priorityActive ? (
        <p className="mt-6 max-w-2xl rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-brown">
          Priority booking is open for the interest list until{" "}
          {formatDateTime(interestBoard!.priorityBookingEndsAt!)}. If you
          signed up on the{" "}
          <Link
            href={`/interest/${interestBoard!.id}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            interest board
          </Link>
          , book now. Public registration opens after that window.
        </p>
      ) : null}

      <dl className="mt-10 grid gap-4 sm:grid-cols-2 max-w-2xl text-sm">
        <div>
          <dt className="font-display font-semibold text-brown">Instructor</dt>
          <dd className="mt-1 text-charcoal">
            {session.instructor.displayName}
          </dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-brown">Capacity</dt>
          <dd className="mt-1 text-charcoal">
            {session.bookedCount} / {session.capacity} booked
            {session.spotsRemaining > 0
              ? ` · ${session.spotsRemaining} open`
              : " · full"}
            {session.waitlistCount > 0
              ? ` · ${session.waitlistCount} waitlisted`
              : ""}
          </dd>
        </div>
        {prereqNames.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="font-display font-semibold text-brown">
              Prerequisites
            </dt>
            <dd className="mt-1 text-charcoal">{prereqNames.join(", ")}</dd>
          </div>
        ) : null}
      </dl>

      {description?.html ? (
        <div
          className="prose-box mt-10 max-w-2xl text-charcoal leading-relaxed [&_a]:text-primary-text [&_a]:underline [&_h2]:font-display [&_h2]:text-brown [&_h3]:font-display [&_h3]:text-brown [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: description.html }}
        />
      ) : null}

      <section className="mt-12 max-w-xl border-t border-border pt-8">
        <h2 className="font-display text-xl font-semibold text-brown">
          Your booking
        </h2>

        {hasActive && booking ? (
          <div className="mt-4 space-y-4">
            <StatusPill tone={bookingTone(booking.status)}>
              {bookingLabel(booking.status, booking.waitlistPosition)}
            </StatusPill>

            {booking.status === "awaiting_payment" ? (
              <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-4">
                <p className="font-display font-semibold text-brown">
                  Payment required
                </p>
                <p className="mt-2 text-sm text-charcoal leading-relaxed">
                  Pay through Zeffy to hold your seat. Staff marks the booking
                  paid after confirmation; unpaid holds expire automatically.
                  {booking.paymentHoldExpiresAt
                    ? ` Hold expires ${formatDateTime(booking.paymentHoldExpiresAt)}.`
                    : ""}
                </p>
                {wallet ? (
                  <p className="mt-3 text-sm text-charcoal">
                    Machine credits:{" "}
                    <span className="font-display font-semibold">
                      {formatMoneyExact(wallet.balanceCents)}
                    </span>
                    . Credits can pay the full class price, or you pay Zeffy
                    the full amount — no split.
                  </p>
                ) : null}
                {wallet && wallet.balanceCents >= session.priceCents ? (
                  <p className="mt-4">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void onPayWithCredits()}
                    >
                      Pay with credits ({formatMoneyExact(session.priceCents)})
                    </Button>
                  </p>
                ) : wallet ? (
                  <p className="mt-3 text-sm text-brown leading-relaxed">
                    {classCreditsShortfallMessage(
                      wallet.balanceCents,
                      session.priceCents,
                    )}
                  </p>
                ) : null}
                {session.zeffyUrl ? (
                  <p className="mt-4">
                    <Button asChild>
                      <a
                        href={session.zeffyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Pay on Zeffy
                      </a>
                    </Button>
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-secondary">
                    No Zeffy link is attached to this class yet — ask staff.
                  </p>
                )}
              </div>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onCancel()}
            >
              Cancel booking
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-secondary leading-relaxed">
              {session.spotsRemaining > 0
                ? session.priceCents > 0
                  ? "Booking a paid class holds a seat until payment is confirmed."
                  : "Free classes confirm instantly when seats remain."
                : "This class is full — you can join the waitlist."}
            </p>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void onBook()}
            >
              {session.spotsRemaining > 0 ? "Book" : "Join waitlist"}
            </Button>
          </div>
        )}

        {message ? (
          <p className="mt-4 text-sm text-charcoal" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-brown" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}
