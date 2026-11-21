"use client";

import type { DisplayBounty } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import {
  PageNote,
  SlideHeading,
  SlideRow,
  SlideRows,
  pageOf,
  toneAt,
} from "./display-parts";

const ROWS = 5;

function boardUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/bounties`;
}

export function PanelBounties({
  bounties,
  turn = 0,
}: {
  bounties: DisplayBounty[];
  /** Counts rotations, so a long list moves on a screen each time round. */
  turn?: number;
}) {
  const screen = pageOf(bounties, ROWS, turn);
  return (
    <>
      <SlideHeading
        lead="Bounty"
        accent="board"
        sub="Make something for a neighbor — scan to claim"
        aside={
          <div className="flex shrink-0 items-start gap-[1vw]">
            <PageNote page={screen.page} pages={screen.pages} />
            <DisplayQr
              url={boardUrl()}
              label="Bounty board"
              className="h-[13vh] w-[13vh]"
            />
          </div>
        }
      />
      <SlideRows rows={ROWS} className="mt-[2vh]">
        {screen.items.map((bounty, i) => (
          <SlideRow
            key={bounty.id}
            tone={toneAt(i)}
            tag={
              bounty.status === "claimed"
                ? bounty.claimedByDisplayName
                  ? `Claimed · ${bounty.claimedByDisplayName}`
                  : "Claimed"
                : "Open"
            }
            title={bounty.title}
            meta={bounty.businessName ?? undefined}
          />
        ))}
      </SlideRows>
    </>
  );
}
