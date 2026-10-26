"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventsCalendar } from "@/components/events-calendar";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type { ClassInterestBoardView } from "@/lib/data";

export default function EventsPage() {
  const { provider, currentUser, revision } = useData();
  const [interestBoards, setInterestBoards] = useState<
    ClassInterestBoardView[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    void provider.listInterestBoards({ publicOnly: true }).then((rows) => {
      if (!cancelled) setInterestBoards(rows.slice(0, 3));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  return (
    <PageShell className="max-w-6xl">
      <PageHero
        eyebrow="Calendar"
        title="Upcoming at The Box"
        description="Classes, workshops, orientation, and open studio. Toggle calendar or list view, filter by type, and register when a checkout link is available."
      />

      <p className="mt-6 max-w-2xl text-sm text-secondary leading-relaxed">
        Looking for memberships instead?{" "}
        <Link href="/join" className="text-primary-text underline">
          See plans on Join
        </Link>
        .
      </p>

      <section className="mt-10 rounded-[1.75rem] border border-primary/30 bg-primary/10 px-5 py-6 sm:px-7">
        <p className="eyebrow">Want a class that isn’t scheduled yet?</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-brown">
          Suggest one — or join an interest list
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-secondary leading-relaxed">
          Raise your hand for ideas the community wants. When enough people
          sign up, staff schedule the class and the interest list gets first
          dibs.
        </p>
        {interestBoards.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {interestBoards.map((board) => (
              <li
                key={board.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/20 pt-3 first:border-0 first:pt-0"
              >
                <div>
                  <Link
                    href={`/interest/${board.id}`}
                    className="font-display font-semibold text-brown hover:underline"
                  >
                    {board.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <StatusPill tone="muted">
                      {board.interestCount}/{board.threshold} interested
                    </StatusPill>
                    {board.status === "ready" ? (
                      <StatusPill tone="ok">Ready to schedule</StatusPill>
                    ) : null}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/interest/${board.id}`}>Sign up</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/interest">Browse interest boards</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/interest#suggest">Suggest a class</Link>
          </Button>
        </div>
      </section>

      <div className="mt-10">
        <EventsCalendar />
      </div>

      <p className="mt-12 max-w-2xl text-sm text-secondary leading-relaxed">
        {currentUser ? (
          <>
            Prefer waitlists and prerequisites in one list?{" "}
            <Link href="/classes" className="text-primary-text underline">
              Open member Classes
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
