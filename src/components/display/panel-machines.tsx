"use client";

import type { DisplayMachineStatus } from "@/lib/data";
import { PageNote, SlideHeading, pageOf, timeLabel } from "./display-parts";

/** Three rows of three: large enough to read from the street. */
const PER_SCREEN = 9;

function statusCopy(m: DisplayMachineStatus): string {
  switch (m.status) {
    case "available":
      return "Available";
    case "in_use":
      return m.since
        ? `In use since ${timeLabel(m.since)}${m.displayName ? ` · ${m.displayName}` : ""}`
        : "In use";
    case "reserved":
      return m.reservedAt ? `Reserved at ${timeLabel(m.reservedAt)}` : "Reserved";
    case "maintenance":
      return "Down for maintenance";
  }
}

const CARD_TONE: Record<DisplayMachineStatus["status"], string> = {
  available: "border-[#bfe3bc] bg-[#e3f4e1]",
  in_use: "border-[#f3c3ba] bg-[#fbe3de]",
  reserved: "border-[#ecd9a8] bg-[#f7ebcf]",
  maintenance: "border-display-rule bg-[#ece7dd]",
};

const STATUS_TONE: Record<DisplayMachineStatus["status"], string> = {
  available: "text-[#1f6b2a]",
  in_use: "text-[#a8402f]",
  reserved: "text-[#7d5a0c]",
  maintenance: "text-display-muted",
};

export function PanelMachines({
  machines,
  turn = 0,
}: {
  machines: DisplayMachineStatus[];
  /** Counts rotations, so a long list moves on a screen each time round. */
  turn?: number;
}) {
  const screen = pageOf(machines, PER_SCREEN, turn);
  return (
    <>
      <SlideHeading
        lead="Machine"
        accent="status"
        aside={<PageNote page={screen.page} pages={screen.pages} />}
      />
      <div className="mt-[2.2vh] grid min-h-0 flex-1 grid-cols-3 grid-rows-[repeat(3,minmax(0,1fr))] gap-x-[1vw] gap-y-[1.4vh]">
        {screen.items.map((m) => (
          <div
            key={m.id}
            className={`flex min-h-0 min-w-0 flex-col justify-center overflow-hidden rounded-[1vw] border-2 px-[1vw] ${CARD_TONE[m.status]}`}
          >
            <p className="line-clamp-2 text-[1.6vw] font-bold leading-[1.2] text-display-ink">
              {m.name}
            </p>
            <p
              className={`mt-[0.4vh] line-clamp-2 text-[1.3vw] font-semibold leading-[1.3] ${STATUS_TONE[m.status]}`}
            >
              {statusCopy(m)}
            </p>
            {m.attendedOperationRequired ? (
              <p className="truncate text-[1.3vw] leading-[1.3] text-display-muted">
                Attend while running
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
