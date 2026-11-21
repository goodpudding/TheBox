"use client";

import type { CSSProperties, ReactNode } from "react";
import type { DisplayFeed } from "@/lib/data";

type DisplayShellProps = {
  feed: DisplayFeed;
  /** The picture side: a `DisplayPhotoSide`. */
  photoSide: ReactNode;
  /** Changes with every slide, so the slide's entrance replays. */
  slideKey: string;
  /** How long a slide stays up. Paces the photo zoom and the progress bar. */
  cadenceMs: number;
  staleMinutes?: number | null;
  children: ReactNode;
};

function hourLabel(hour: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12} ${hour < 12 || hour === 24 ? "AM" : "PM"}`;
}

/**
 * The frame every slide sits in: a picture on the left 44% of the screen and
 * the slide's content on a warm panel to its right.
 */
export function DisplayShell({
  feed,
  photoSide,
  slideKey,
  cadenceMs,
  staleMinutes,
  children,
}: DisplayShellProps) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(feed.now));
  const hours = `${hourLabel(feed.hours.openHour)} – ${hourLabel(feed.hours.closeHour)}`;
  const calm = feed.config.motion === "calm";
  const style = { "--display-cadence": `${cadenceMs}ms` } as CSSProperties;

  return (
    <div
      data-testid="display-root"
      className="display-root fixed inset-0 flex overflow-hidden bg-display-panel font-display text-display-ink"
      style={style}
    >
      <aside className="relative h-full w-[44vw] shrink-0 overflow-hidden bg-display-coral">
        {photoSide}
      </aside>

      <section className="flex h-full min-w-0 flex-1 flex-col px-[3vw] pb-[2.2vh] pt-[3.2vh]">
        <header className="flex shrink-0 items-start justify-between gap-[2vw]">
          <div className="min-w-0">
            <p className="truncate text-[1.3vw] font-bold uppercase tracking-[0.18em] text-display-gold">
              Discover Burien Makerspace
            </p>
            <p className="text-[3vw] font-extrabold leading-none text-display-ink">
              The Box
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`inline-block rounded-full px-[1.2vw] py-[0.7vh] text-[1.4vw] font-bold ${
                feed.isOpen
                  ? "bg-[#e3f4e1] text-[#1f6b2a]"
                  : "bg-display-rule text-display-muted"
              }`}
            >
              {feed.isOpen ? "Open now" : "Closed"}
            </p>
            <p className="mt-[0.7vh] text-[1.3vw] text-display-muted">
              {dateLabel} · {hours}
            </p>
            {staleMinutes != null && staleMinutes >= 2 ? (
              <p className="text-[1.3vw] text-display-muted">
                Updated {staleMinutes} min ago
              </p>
            ) : null}
          </div>
        </header>

        <main
          key={slideKey}
          data-testid="display-content"
          className="display-slide-in mt-[3vh] flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {children}
        </main>

        <div
          className="mt-[1.6vh] h-[0.7vh] shrink-0 overflow-hidden rounded-full bg-display-rule"
          aria-hidden
        >
          {calm ? null : (
            <div
              key={slideKey}
              className="display-progress-bar h-full w-full rounded-full bg-display-coral"
            />
          )}
        </div>
      </section>
    </div>
  );
}
