"use client";

import type { DisplayMembershipTier } from "@/lib/data";
import { DisplayQr } from "./display-qr";
import { PageNote, SlideHeading, SlideRows, pageOf, toneAt } from "./display-parts";

const PER_SCREEN = 5;

const BAR = {
  coral: "bg-display-coral",
  teal: "bg-display-teal",
  gold: "bg-display-gold",
} as const;

function priceLabel(cents: number, interval: string): string {
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  if (interval === "monthly") return `$${dollars}/mo`;
  if (interval === "annual") return `$${dollars}/yr`;
  if (interval === "daily") return `$${dollars}/day`;
  return `$${dollars}`;
}

export function PanelMembership({
  membership,
  turn = 0,
}: {
  membership: DisplayMembershipTier;
  /** Counts rotations, so a long list moves on a screen each time round. */
  turn?: number;
}) {
  const screen = pageOf(membership.products, PER_SCREEN, turn);
  return (
    <>
      <SlideHeading
        lead="Membership"
        sub="Scan to join"
        aside={
          <div className="flex shrink-0 items-start gap-[1vw]">
            <PageNote page={screen.page} pages={screen.pages} />
            <DisplayQr url={membership.joinUrl} label="Join" />
          </div>
        }
      />
      <SlideRows rows={PER_SCREEN} className="mt-[2vh]">
        {screen.items.map((p, i) => (
          <li
            key={p.id}
            className="flex min-h-0 items-center gap-[1.2vw] overflow-hidden border-b-2 border-display-rule last:border-b-0"
          >
            <span
              className={`h-[62%] w-[0.7vw] shrink-0 rounded-full ${BAR[toneAt(i)]}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-[1vw] text-[2vw] font-bold leading-[1.15] text-display-ink">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-display-coral">
                  {priceLabel(p.priceCents, p.billingInterval)}
                </span>
              </p>
              <p className="mt-[0.2vh] line-clamp-2 text-[1.3vw] leading-[1.25] text-display-muted">
                {p.summary}
              </p>
            </div>
          </li>
        ))}
      </SlideRows>
    </>
  );
}
