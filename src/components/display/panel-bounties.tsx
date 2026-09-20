"use client";

import type { DisplayBounty } from "@/lib/data";
import { DisplayQr } from "./display-qr";

function boardUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/bounties`;
}

export function PanelBounties({ bounties }: { bounties: DisplayBounty[] }) {
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <div className="flex flex-wrap items-start justify-between gap-[2vw]">
        <div>
          <h1 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-semibold text-brown">
            Bounty board
          </h1>
          <p className="mt-[0.6vh] font-display text-[clamp(1rem,1.7vw,1.5rem)] text-secondary">
            Make something for a neighbor — scan to claim
          </p>
        </div>
        <DisplayQr url={boardUrl()} size={140} label="Bounty board" />
      </div>
      <ul className="grid min-h-0 flex-1 grid-cols-1 content-start gap-[1.6vh] overflow-hidden md:grid-cols-2">
        {bounties.map((bounty) => (
          <li
            key={bounty.id}
            className="border-b border-border/70 pb-[1.2vh]"
          >
            <p className="font-display text-[clamp(0.85rem,1.3vw,1.15rem)] font-semibold uppercase tracking-[0.14em] text-primary-text">
              {bounty.status === "claimed"
                ? bounty.claimedByDisplayName
                  ? `Claimed · ${bounty.claimedByDisplayName}`
                  : "Claimed"
                : "Open"}
            </p>
            <p className="mt-[0.4vh] font-display text-[clamp(1.25rem,2.3vw,2.1rem)] font-semibold leading-tight text-brown">
              {bounty.title}
            </p>
            {bounty.businessName ? (
              <p className="mt-[0.3vh] font-display text-[clamp(1rem,1.6vw,1.4rem)] text-secondary">
                {bounty.businessName}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
