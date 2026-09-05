"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  dayKey,
  formatTimeRange,
  formatWeekdayDate,
} from "@/lib/format";
import { formatMoney } from "@/lib/utils";
import type { ClassCategory, ClassSessionView } from "@/lib/data";

const CATEGORY_LABEL: Record<ClassCategory, string> = {
  orientation: "Orientation",
  certification_checkoff: "Certification",
  workshop: "Workshop",
  open_studio: "Open studio",
};

export function UpcomingEvents({
  limit,
  showAllLink = true,
}: {
  limit?: number;
  showAllLink?: boolean;
}) {
  const { provider, currentUser, revision } = useData();
  const [classes, setClasses] = useState<ClassSessionView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await provider.listClasses({ upcomingOnly: true });
      if (!cancelled) setClasses(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const visible = useMemo(() => {
    if (!classes) return null;
    return typeof limit === "number" ? classes.slice(0, limit) : classes;
  }, [classes, limit]);

  const byDay = useMemo(() => {
    if (!visible) return null;
    const map = new Map<string, ClassSessionView[]>();
    for (const session of visible) {
      const key = dayKey(session.startsAt);
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visible]);

  if (classes === null) {
    return <p className="text-secondary">Loading upcoming events…</p>;
  }

  if (classes.length === 0) {
    return (
      <p className="text-secondary leading-relaxed">
        No upcoming sessions on the calendar yet. Check back soon, or{" "}
        <a
          href="https://www.discoverburien.org/makerspace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-text underline"
        >
          see Discover Burien
        </a>{" "}
        for the latest.
      </p>
    );
  }

  return (
    <div>
      <ol className="space-y-10">
        {byDay?.map(([key, sessions]) => (
          <li key={key}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              {formatWeekdayDate(sessions[0].startsAt)}
            </h3>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                >
                  <div className="min-w-0">
                    <p className="font-display text-xs font-semibold uppercase tracking-wider text-secondary">
                      {CATEGORY_LABEL[session.category]} ·{" "}
                      {formatTimeRange(session.startsAt, session.endsAt)}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold text-brown">
                      {session.title}
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      {session.location}
                      {session.spotsRemaining <= 0
                        ? " · Waitlist"
                        : session.spotsRemaining <= 3
                          ? ` · ${session.spotsRemaining} spots left`
                          : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <p className="font-display text-sm font-semibold text-charcoal">
                      {session.priceCents === 0
                        ? "Free"
                        : formatMoney(session.priceCents)}
                    </p>
                    {session.zeffyUrl ? (
                      <Button asChild size="sm" variant="secondary">
                        <a
                          href={session.zeffyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Register
                        </a>
                      </Button>
                    ) : currentUser ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/classes/${session.id}`}>Details</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/login">Sign in to book</Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {showAllLink && limit && classes.length > limit ? (
        <p className="mt-8">
          <Link
            href="/events"
            className="font-display text-sm font-semibold text-primary-text underline"
          >
            See full calendar →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
