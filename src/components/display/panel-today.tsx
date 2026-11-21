"use client";

import type { DisplayFeed } from "@/lib/data";
import {
  ChipGrid,
  EmptyNote,
  SectionLabel,
  SlideHeading,
  SlideRow,
  SlideRows,
  spotsLabel,
  timeLabel,
  toneAt,
} from "./display-parts";

const SESSION_ROWS = 4;
const RESERVATION_CHIPS = 6;

export function PanelToday({ feed }: { feed: DisplayFeed }) {
  const sessions = feed.todaySessions.slice(0, SESSION_ROWS);
  const moreSessions = feed.todaySessions.length - sessions.length;
  const reservations = feed.todayReservations.map(
    (r) =>
      `${timeLabel(r.startsAt)} · ${r.machineName}${r.displayName ? ` · ${r.displayName}` : ""}`,
  );

  return (
    <>
      <SlideHeading lead="Today" accent="at The Box" />

      <div className="mt-[2.2vh] flex min-h-0 flex-1 flex-col">
        <SectionLabel>
          Classes &amp; checkoffs{moreSessions > 0 ? ` · ${moreSessions} more` : ""}
        </SectionLabel>
        {sessions.length === 0 ? (
          <div className="mt-[1vh] flex-1">
            <EmptyNote>No sessions on the calendar today.</EmptyNote>
          </div>
        ) : (
          <SlideRows rows={SESSION_ROWS} className="mt-[0.6vh]">
            {sessions.map((s, i) => (
              <SlideRow
                key={s.id}
                tone={toneAt(i)}
                title={s.title}
                meta={`${timeLabel(s.startsAt)} – ${timeLabel(s.endsAt)} · ${spotsLabel(s.spotsRemaining)}`}
              />
            ))}
          </SlideRows>
        )}
      </div>

      <div className="mt-[1.6vh] shrink-0">
        <SectionLabel>Machine reservations</SectionLabel>
        {reservations.length === 0 ? (
          <div className="mt-[1vh]">
            <EmptyNote>No machine reservations today.</EmptyNote>
          </div>
        ) : (
          <div className="mt-[1vh]">
            <ChipGrid labels={reservations} max={RESERVATION_CHIPS} />
          </div>
        )}
      </div>
    </>
  );
}
