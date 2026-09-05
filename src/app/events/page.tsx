"use client";

import Link from "next/link";
import { EventsCalendar } from "@/components/events-calendar";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";

export default function EventsPage() {
  const { currentUser } = useData();

  return (
    <PageShell className="max-w-6xl">
      <PageHero
        eyebrow="Calendar"
        title="Upcoming at The Box"
        description="Browse by month, week, or list. Filter by type, click an event for details, and register when a checkout link is available."
      />

      <div className="mt-10">
        <EventsCalendar />
      </div>

      <p className="mt-12 max-w-2xl text-sm text-secondary leading-relaxed">
        {currentUser ? (
          <>
            Prefer the member booking flow?{" "}
            <Link href="/classes" className="text-primary-text underline">
              Open Classes
            </Link>
            .
          </>
        ) : (
          <>
            Already a member?{" "}
            <Link href="/login" className="text-primary-text underline">
              Sign in
            </Link>{" "}
            to track seats, waitlists, and prerequisites in one place.
          </>
        )}
      </p>
    </PageShell>
  );
}
