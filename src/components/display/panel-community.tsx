"use client";

import type { DisplayEventItem } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import {
  PageNote,
  SlideHeading,
  SlideRows,
  dateBlock,
  pageOf,
  timeLabel,
  toneAt,
} from "./display-parts";

const PER_SCREEN = 4;

const BLOCK = {
  coral: "bg-display-coral",
  teal: "bg-display-teal",
  gold: "bg-display-gold",
} as const;

/**
 * The open events anyone can walk into: Repair Café, Queer Makers Night and
 * the like. Together on one slide, so a passer-by sees there is something
 * for them without reading the whole class list.
 */
export function PanelCommunity({
  events,
  turn = 0,
}: {
  events: DisplayEventItem[];
  /** Counts rotations, so a long list moves on a screen each time round. */
  turn?: number;
}) {
  const screen = pageOf(events, PER_SCREEN, turn);
  const allFree = events.every((event) => event.priceCents <= 0);

  return (
    <>
      <SlideHeading
        lead="Community"
        accent="events"
        sub={
          allFree
            ? "Free. Everyone welcome — scan to sign up"
            : "Everyone welcome — scan to sign up"
        }
        aside={<PageNote page={screen.page} pages={screen.pages} />}
      />
      <SlideRows rows={PER_SCREEN} className="mt-[1.6vh]">
        {screen.items.map((event, i) => {
          const [weekday, day] = dateBlock(event.startsAt);
          return (
            <li
              key={event.id}
              className="flex min-h-0 items-center gap-[1.4vw] overflow-hidden border-b-2 border-display-rule last:border-b-0"
            >
              <div
                className={`flex h-[76%] w-[8.4vw] shrink-0 flex-col items-center justify-center rounded-[1.1vw] text-white ${BLOCK[toneAt(i)]}`}
              >
                <span className="text-[2.3vw] font-extrabold leading-none">
                  {weekday}
                </span>
                <span className="mt-[0.4vh] text-[1.3vw] font-bold">{day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[2.2vw] font-bold leading-[1.12] text-display-ink">
                  {event.title}
                </p>
                <p className="mt-[0.3vh] truncate text-[1.4vw] text-display-muted">
                  {timeLabel(event.startsAt)}
                  {event.priceCents <= 0 ? " · Free" : ""}
                </p>
              </div>
              <DisplayQr
                url={event.bookingUrl}
                label={`Sign up for ${event.title}`}
              />
            </li>
          );
        })}
      </SlideRows>
    </>
  );
}
