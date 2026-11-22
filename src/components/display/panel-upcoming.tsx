"use client";

import type { DisplayUpcomingItem } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import {
  PageNote,
  SlideHeading,
  SlideRow,
  SlideRows,
  dayLabel,
  timeLabel,
  toneAt,
} from "./display-parts";

/** The first screen: the next class as a card, then three more. */
const FIRST_SCREEN = 4;
/** Later screens are plain rows. */
const ROWS_PER_SCREEN = 5;

function BookingRow({ item, index }: { item: DisplayUpcomingItem; index: number }) {
  return (
    <SlideRow
      tone={toneAt(index)}
      title={item.title}
      meta={`${dayLabel(item.startsAt)} · ${timeLabel(item.startsAt)}`}
      aside={<DisplayQr url={item.bookingUrl} label={`Book ${item.title}`} />}
    />
  );
}

export function PanelUpcoming({
  items,
  turn = 0,
}: {
  items: DisplayUpcomingItem[];
  /** Counts rotations, so a long list moves on a screen each time round. */
  turn?: number;
}) {
  const later = items.slice(FIRST_SCREEN);
  const screens = 1 + Math.ceil(later.length / ROWS_PER_SCREEN);
  const screen = ((turn % screens) + screens) % screens;
  const note = <PageNote page={screen} pages={screens} />;

  if (screen > 0) {
    const rows = later.slice(
      (screen - 1) * ROWS_PER_SCREEN,
      screen * ROWS_PER_SCREEN,
    );
    return (
      <>
        <SlideHeading lead="Coming" accent="up" aside={note} />
        <SlideRows rows={ROWS_PER_SCREEN} className="mt-[2vh]">
          {rows.map((item, i) => (
            <BookingRow key={item.id} item={item} index={i} />
          ))}
        </SlideRows>
      </>
    );
  }

  const [next, ...rest] = items.slice(0, FIRST_SCREEN);
  return (
    <>
      <SlideHeading lead="Coming" accent="up" aside={note} />
      {next ? (
        <div className="mt-[2.4vh] flex shrink-0 items-center gap-[1.6vw] rounded-[1.6vw] bg-display-coral px-[1.8vw] py-[2.2vh] text-white">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.3vw] font-extrabold uppercase tracking-[0.16em] text-white/90">
              Next class · {dayLabel(next.startsAt)} · {timeLabel(next.startsAt)}
            </p>
            <h2 className="mt-[0.5vh] line-clamp-2 text-[2.9vw] font-extrabold leading-[1.08]">
              {next.title}
            </h2>
            <p className="mt-[0.6vh] truncate text-[1.6vw] font-semibold">
              Scan to book
            </p>
          </div>
          <DisplayQr
            url={next.bookingUrl}
            label={`Book ${next.title}`}
            className="h-[10.5vw] w-[10.5vw]"
          />
        </div>
      ) : null}
      <SlideRows rows={FIRST_SCREEN - 1} className="mt-[1.2vh]">
        {rest.map((item, i) => (
          <BookingRow key={item.id} item={item} index={i} />
        ))}
      </SlideRows>
    </>
  );
}
