"use client";

import type { DisplayBounty } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import { SlideHeading, SlideRow, SlideRows, toneAt } from "./display-parts";

const ROWS = 5;

function boardUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/bounties`;
}

export function PanelBounties({ bounties }: { bounties: DisplayBounty[] }) {
  return (
    <>
      <SlideHeading
        lead="Bounty"
        accent="board"
        sub="Make something for a neighbor — scan to claim"
        aside={<DisplayQr url={boardUrl()} label="Bounty board" />}
      />
      <SlideRows rows={ROWS} className="mt-[2vh]">
        {bounties.slice(0, ROWS).map((bounty, i) => (
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
