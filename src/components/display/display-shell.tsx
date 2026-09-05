"use client";

import type { ReactNode } from "react";
import type { DisplayFeed } from "@/lib/data";

type DisplayShellProps = {
  feed: DisplayFeed;
  children: ReactNode;
  staleMinutes?: number | null;
};

export function DisplayShell({
  feed,
  children,
  staleMinutes,
}: DisplayShellProps) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(feed.now));

  return (
    <div className="display-root fixed inset-0 overflow-hidden bg-page text-brown">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-[1.5vw] border-b border-border px-[2.5vw] py-[1.4vh]">
        <div className="min-w-0">
          <p className="font-display text-[clamp(0.7rem,1.1vw,1rem)] font-semibold uppercase tracking-[0.18em] text-secondary">
            Discover Burien
          </p>
          <p className="font-display text-[clamp(1.6rem,3.2vw,3.2rem)] font-semibold leading-none tracking-tight text-brown">
            The Box
          </p>
        </div>
        <div className="text-center">
          <p className="font-display text-[clamp(1.1rem,2vw,2rem)] font-semibold text-brown">
            {dateLabel}
          </p>
          <p className="mt-[0.4vh] font-display text-[clamp(0.95rem,1.5vw,1.4rem)] text-secondary">
            {feed.hours.label}
          </p>
        </div>
        <div className="justify-self-end text-right">
          <p
            className={`font-display text-[clamp(1.2rem,2.2vw,2.2rem)] font-semibold ${
              feed.isOpen ? "text-primary-text" : "text-secondary"
            }`}
          >
            {feed.isOpen ? "Open now" : "Closed"}
          </p>
          {staleMinutes != null && staleMinutes >= 2 ? (
            <p className="mt-[0.3vh] font-display text-[clamp(0.7rem,1vw,0.95rem)] text-secondary">
              Updated {staleMinutes} min ago
            </p>
          ) : null}
        </div>
      </header>
      <main className="h-[calc(100%-clamp(4.5rem,10vh,7.5rem))] px-[2.5vw] py-[2vh]">
        {children}
      </main>
    </div>
  );
}
