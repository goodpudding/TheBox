"use client";

import "temporal-polyfill/global";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createViewDay,
  createViewList,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
  type CalendarEvent,
} from "@schedule-x/calendar";
import { createEventModalPlugin } from "@schedule-x/event-modal";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import "@schedule-x/theme-default/dist/index.css";

import { useData } from "@/components/providers";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";
import { formatMoney, cn } from "@/lib/utils";
import type { ClassCategory, ClassSessionView } from "@/lib/data";

type LayoutMode = "calendar" | "list";

const CATEGORIES: { id: ClassCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "orientation", label: "Orientation" },
  { id: "workshop", label: "Workshops" },
  { id: "certification_checkoff", label: "Certification" },
  { id: "open_studio", label: "Open studio" },
];

const CATEGORY_LABEL: Record<ClassCategory, string> = {
  orientation: "Orientation",
  certification_checkoff: "Certification",
  workshop: "Workshop",
  open_studio: "Open studio",
};

const CALENDARS = {
  orientation: {
    colorName: "orientation",
    label: "Orientation",
    lightColors: {
      main: "#cf9426",
      container: "#f5e6c8",
      onContainer: "#3a2408",
    },
  },
  workshop: {
    colorName: "workshop",
    label: "Workshop",
    lightColors: {
      main: "#cd7d3c",
      container: "#f3dfcf",
      onContainer: "#3a2408",
    },
  },
  certification_checkoff: {
    colorName: "certification_checkoff",
    label: "Certification",
    lightColors: {
      main: "#e37263",
      container: "#f8ddd9",
      onContainer: "#3a2408",
    },
  },
  open_studio: {
    colorName: "open_studio",
    label: "Open studio",
    lightColors: {
      main: "#3a2408",
      container: "#e8e0d8",
      onContainer: "#3a2408",
    },
  },
} as const;

const TIMEZONE = "America/Los_Angeles";

function toZoned(iso: string) {
  return Temporal.Instant.from(new Date(iso).toISOString()).toZonedDateTimeISO(
    TIMEZONE,
  );
}

function toCalendarEvent(session: ClassSessionView): CalendarEvent {
  const price =
    session.priceCents === 0 ? "Free" : formatMoney(session.priceCents);
  const seats =
    session.spotsRemaining <= 0
      ? "Waitlist"
      : `${session.spotsRemaining} spots left`;

  return {
    id: session.id,
    title: session.title,
    start: toZoned(session.startsAt),
    end: toZoned(session.endsAt),
    location: session.location,
    calendarId: session.category,
    description: [
      CATEGORY_LABEL[session.category],
      price,
      seats,
      session.instructor.displayName
        ? `Instructor: ${session.instructor.displayName}`
        : null,
      session.zeffyUrl
        ? `Register: ${session.zeffyUrl}`
        : "Sign in on the portal to book",
    ]
      .filter(Boolean)
      .join("\n"),
    zeffyUrl: session.zeffyUrl,
    category: session.category,
  };
}

function sessionPriceLabel(session: ClassSessionView) {
  return session.priceCents === 0 ? "Free" : formatMoney(session.priceCents);
}

function sessionSeatsLabel(session: ClassSessionView) {
  if (session.spotsRemaining > 0) {
    return `${session.spotsRemaining} spot${session.spotsRemaining === 1 ? "" : "s"} left`;
  }
  if (session.waitlistCount > 0) {
    return `Full · ${session.waitlistCount} on waitlist`;
  }
  return "Full · join waitlist";
}

export function EventsCalendar() {
  const { provider, currentUser, revision } = useData();
  const [classes, setClasses] = useState<ClassSessionView[] | null>(null);
  const [category, setCategory] = useState<ClassCategory | "all">("all");
  const [layout, setLayout] = useState<LayoutMode>("calendar");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const eventModal = useMemo(() => createEventModalPlugin(), []);
  const monthGrid = useMemo(() => createViewMonthGrid(), []);

  const calendar = useNextCalendarApp(
    {
      views: [
        monthGrid,
        createViewMonthAgenda(),
        createViewWeek(),
        createViewDay(),
        createViewList(),
      ],
      defaultView: monthGrid.name,
      locale: "en-US",
      timezone: TIMEZONE,
      firstDayOfWeek: 7,
      dayBoundaries: { start: "09:00", end: "21:00" },
      weekOptions: { gridHeight: 720, gridStep: 60 },
      calendars: { ...CALENDARS },
      events: [],
      callbacks: {
        onEventClick(event) {
          setSelectedId(String(event.id));
        },
      },
    },
    [eventModal],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Full published catalog so month navigation isn't empty
      const rows = await provider.listClasses();
      if (!cancelled) setClasses(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const filtered = useMemo(() => {
    if (!classes) return [];
    if (category === "all") return classes;
    return classes.filter((c) => c.category === category);
  }, [classes, category]);

  const listSessions = useMemo(() => {
    const now = Date.now();
    return [...filtered]
      .filter((s) => new Date(s.startsAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
  }, [filtered]);

  useEffect(() => {
    if (!calendar) return;
    calendar.events.set(filtered.map(toCalendarEvent));
  }, [calendar, filtered]);

  const selected = classes?.find((c) => c.id === selectedId) ?? null;

  if (classes === null || !calendar) {
    return <p className="text-secondary">Loading calendar…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "font-display rounded-full px-4 py-2 text-sm font-medium transition-colors",
                category === c.id
                  ? "bg-primary/15 text-primary-text"
                  : "text-secondary hover:text-brown",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="Calendar layout"
          className="inline-flex rounded-full border border-border bg-surface p-1"
        >
          {(
            [
              { id: "calendar", label: "Calendar" },
              { id: "list", label: "List" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={layout === option.id}
              onClick={() => setLayout(option.id)}
              className={cn(
                "font-display rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                layout === option.id
                  ? "bg-button text-white"
                  : "text-secondary hover:text-brown",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {layout === "calendar" ? (
        <>
          <div className="sx-calendar overflow-hidden rounded-2xl border border-border bg-surface">
            <ScheduleXCalendar calendarApp={calendar} />
          </div>

          {selected ? (
            <aside className="rounded-2xl border border-border bg-surface px-5 py-5 sm:px-6">
              <p className="eyebrow">{CATEGORY_LABEL[selected.category]}</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-brown">
                {selected.title}
              </h3>
              <p className="mt-2 text-secondary">
                {selected.location} · {sessionPriceLabel(selected)}
                {selected.spotsRemaining <= 0
                  ? " · Waitlist"
                  : ` · ${selected.spotsRemaining} spots left`}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {selected.zeffyUrl ? (
                  <a
                    href={selected.zeffyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display inline-flex h-11 items-center rounded-full bg-button px-5 text-sm font-semibold text-white hover:bg-button-hover"
                  >
                    Register
                  </a>
                ) : null}
                {currentUser ? (
                  <Link
                    href={`/classes/${selected.id}`}
                    className="font-display inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-brown"
                  >
                    Member details
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="font-display inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-brown"
                  >
                    Sign in to book
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="font-display text-sm text-secondary underline"
                >
                  Clear
                </button>
              </div>
            </aside>
          ) : (
            <p className="text-sm text-secondary">
              Click an event for details and registration. Use Month, Week, Day,
              or List in the calendar toolbar.
            </p>
          )}
        </>
      ) : listSessions.length === 0 ? (
        <p className="text-secondary">
          No upcoming events
          {category !== "all"
            ? ` in ${CATEGORIES.find((c) => c.id === category)?.label ?? category}`
            : ""}
          .
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {listSessions.map((session) => (
            <li key={session.id} className="py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(session.id)}
                    className="text-left font-display text-xl font-semibold text-brown hover:text-primary-text"
                  >
                    {session.title}
                  </button>
                  <p className="mt-1 text-sm text-secondary">
                    {formatDateTime(session.startsAt)}
                    {session.location ? ` · ${session.location}` : ""}
                  </p>
                </div>
                <StatusPill tone="muted">
                  {CATEGORY_LABEL[session.category]}
                </StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal">
                <span>{sessionPriceLabel(session)}</span>
                <span>{sessionSeatsLabel(session)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-4">
                {session.zeffyUrl ? (
                  <a
                    href={session.zeffyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display text-sm font-semibold text-primary-text hover:underline"
                  >
                    Register on Zeffy →
                  </a>
                ) : null}
                {currentUser ? (
                  <Link
                    href={`/classes/${session.id}`}
                    className="font-display text-sm font-semibold text-brown hover:underline"
                  >
                    Member details →
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="font-display text-sm font-semibold text-brown hover:underline"
                  >
                    Sign in to book →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
