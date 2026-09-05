"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/utils";
import type { ClassCategory, ClassSessionView } from "@/lib/data";

const CATEGORIES: { value: ClassCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "orientation", label: "Orientation" },
  { value: "certification_checkoff", label: "Certification checkoff" },
  { value: "workshop", label: "Workshop" },
  { value: "open_studio", label: "Open studio" },
];

const CATEGORY_LABEL: Record<ClassCategory, string> = {
  orientation: "Orientation",
  certification_checkoff: "Certification checkoff",
  workshop: "Workshop",
  open_studio: "Open studio",
};

const BOOKING_TONE: Record<
  string,
  "ok" | "warn" | "info" | "muted" | "danger"
> = {
  booked: "ok",
  awaiting_payment: "warn",
  waitlisted: "info",
};

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

export default function ClassesPage() {
  return (
    <MemberGate>
      <ClassesBody />
    </MemberGate>
  );
}

function ClassesBody() {
  const { provider, revision } = useData();
  const [classes, setClasses] = useState<ClassSessionView[] | null>(null);
  const [category, setCategory] = useState<ClassCategory | "all">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await provider.listClasses({ upcomingOnly: true });
        if (!cancelled) {
          setClasses(rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load classes");
          setClasses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const filtered = useMemo(() => {
    if (!classes) return null;
    if (category === "all") return classes;
    return classes.filter((c) => c.category === category);
  }, [classes, category]);

  return (
    <PageShell>
      <PageHero
        eyebrow="Classes"
        title="Upcoming sessions"
        description="Orientation, workshops, checkoffs, and open studio. Book a seat or join the waitlist when a class fills up."
      />

      <div className="mt-10 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={
              category === c.value
                ? "rounded-full bg-button px-4 py-2 font-display text-sm font-semibold text-white"
                : "rounded-full border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-brown hover:border-brown/40"
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-8 text-sm text-brown" role="alert">
          {error}
        </p>
      ) : null}

      {filtered === null ? (
        <p className="mt-12 text-secondary">Loading classes…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-12 text-secondary">
          No upcoming classes
          {category !== "all"
            ? ` in ${CATEGORIES.find((c) => c.value === category)?.label ?? category}`
            : ""}
          .
        </p>
      ) : (
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {filtered.map((session) => {
            const booking = session.currentUserBooking;
            const price =
              session.priceCents <= 0 ? "Free" : formatMoney(session.priceCents);
            const spots =
              session.spotsRemaining > 0
                ? `${session.spotsRemaining} spot${session.spotsRemaining === 1 ? "" : "s"} left`
                : session.waitlistCount > 0
                  ? `Full · ${session.waitlistCount} on waitlist`
                  : "Full · join waitlist";

            return (
              <li key={session.id} className="py-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/classes/${session.id}`}
                      className="font-display text-xl font-semibold text-brown hover:text-primary-text"
                    >
                      {session.title}
                    </Link>
                    <p className="mt-1 text-sm text-secondary">
                      {formatDateTime(session.startsAt)}
                      {session.location ? ` · ${session.location}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="muted">
                      {CATEGORY_LABEL[session.category]}
                    </StatusPill>
                    {booking ? (
                      <StatusPill tone={BOOKING_TONE[booking.status] ?? "info"}>
                        {bookingLabel(
                          booking.status,
                          booking.waitlistPosition,
                        )}
                      </StatusPill>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal">
                  <span>{price}</span>
                  <span>{spots}</span>
                </div>
                <p className="mt-4">
                  <Link
                    href={`/classes/${session.id}`}
                    className="font-display text-sm font-semibold text-primary-text hover:underline"
                  >
                    View details →
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
