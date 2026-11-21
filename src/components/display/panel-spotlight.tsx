"use client";

import type { DisplayEventItem } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import {
  longDayLabel,
  priceLabel,
  spotsLabel,
  timeRangeLabel,
} from "./display-parts";

/** What kind of event this is and what it costs, for the tag above the title. */
function eventTag(event: DisplayEventItem): { text: string; tone: string } {
  const free = event.priceCents <= 0;
  const price = free ? "" : ` · ${priceLabel(event.priceCents)}`;
  switch (event.category) {
    case "open_studio":
      return free
        ? { text: "Free community event", tone: "bg-display-teal text-white" }
        : { text: `Community event${price}`, tone: "bg-display-teal text-white" };
    case "orientation":
      return { text: `Orientation${price}`, tone: "bg-display-gold text-white" };
    case "certification_checkoff":
      return {
        text: `Certification checkoff${price}`,
        tone: "bg-display-gold text-white",
      };
    case "workshop":
      return free
        ? { text: "Free workshop", tone: "bg-display-coral text-white" }
        : { text: `Workshop${price}`, tone: "bg-display-coral text-white" };
  }
}

/**
 * One event with room to say what it is about. Each time the rotation comes
 * round it is the next event's turn, so over a few minutes the screen works
 * through everything coming up.
 */
export function PanelSpotlight({
  events,
  turn = 0,
}: {
  events: DisplayEventItem[];
  /** Counts rotations: which event's turn it is. */
  turn?: number;
}) {
  if (events.length === 0) return null;
  const event = events[((turn % events.length) + events.length) % events.length]!;
  const tag = eventTag(event);

  return (
    <>
      <p className="shrink-0">
        <span
          className={`inline-block max-w-full truncate rounded-full px-[1vw] py-[0.6vh] text-[1.3vw] font-extrabold uppercase tracking-[0.16em] ${tag.tone}`}
        >
          {tag.text}
        </span>
      </p>
      <h1 className="mt-[1.6vh] line-clamp-2 shrink-0 text-[4.4vw] font-extrabold leading-[1.05] text-display-ink">
        {event.title}
      </h1>
      <p className="mt-[1.4vh] shrink-0 truncate text-[2.2vw] font-bold text-display-coral">
        {longDayLabel(event.startsAt)} ·{" "}
        {timeRangeLabel(event.startsAt, event.endsAt)}
      </p>
      {event.description ? (
        <p className="mt-[2vh] line-clamp-5 shrink-0 text-[1.7vw] leading-[1.38] text-display-muted">
          {event.description}
        </p>
      ) : null}
      <div className="mt-auto flex shrink-0 items-center gap-[1.6vw] rounded-[1.4vw] bg-display-ink px-[1.6vw] py-[1.8vh] text-white">
        <DisplayQr
          url={event.bookingUrl}
          label={`Sign up for ${event.title}`}
          className="h-[9vw] w-[9vw]"
        />
        <div className="min-w-0">
          <p className="truncate text-[2.1vw] font-bold">Scan to sign up</p>
          <p className="truncate text-[1.5vw] font-semibold text-[#fbc84b]">
            {spotsLabel(event.spotsRemaining)}
          </p>
        </div>
      </div>
    </>
  );
}
