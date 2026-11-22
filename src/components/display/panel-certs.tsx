"use client";

import type { DisplayCheckoff, DisplayOnlineCert } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import {
  ChipGrid,
  EmptyNote,
  SectionLabel,
  SlideHeading,
  SlideRow,
  SlideRows,
  dayLabel,
  timeLabel,
  toneAt,
} from "./display-parts";

const CHECKOFF_ROWS = 3;
const ONLINE_CHIPS = 8;

function learnUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/learn`;
}

export function PanelCerts({
  checkoffs,
  onlineCerts,
}: {
  checkoffs: DisplayCheckoff[];
  onlineCerts: DisplayOnlineCert[];
}) {
  const rows = checkoffs.slice(0, CHECKOFF_ROWS);
  const online = onlineCerts.map((c) => c.name);

  return (
    <>
      <SlideHeading
        lead="Get"
        accent="certified"
        sub="Learn online, then check off in the shop"
        aside={
          <DisplayQr
            url={learnUrl()}
            label="Start online learning"
            className="h-[13vh] w-[13vh]"
          />
        }
      />

      <div className="mt-[2.2vh] flex min-h-0 flex-1 flex-col">
        <SectionLabel>Checkoffs this week</SectionLabel>
        {rows.length === 0 ? (
          <div className="mt-[1vh] flex-1">
            <EmptyNote>No checkoff sessions in the next week.</EmptyNote>
          </div>
        ) : (
          <SlideRows rows={CHECKOFF_ROWS} className="mt-[0.6vh]">
            {rows.map((c, i) => (
              <SlideRow
                key={c.id}
                tone={toneAt(i)}
                title={c.title}
                meta={`${dayLabel(c.startsAt)} · ${timeLabel(c.startsAt)}`}
              />
            ))}
          </SlideRows>
        )}
      </div>

      {online.length > 0 ? (
        <div className="mt-[1.6vh] shrink-0">
          <SectionLabel>Start online</SectionLabel>
          <div className="mt-[1vh]">
            <ChipGrid labels={online} max={ONLINE_CHIPS} />
          </div>
        </div>
      ) : null}
    </>
  );
}
