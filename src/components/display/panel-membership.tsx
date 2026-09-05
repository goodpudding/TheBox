"use client";

import type { DisplayMembershipTier } from "@/lib/data";
import { DisplayQr } from "./display-qr";

function priceLabel(cents: number, interval: string): string {
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  if (interval === "monthly") return `$${dollars}/mo`;
  if (interval === "annual") return `$${dollars}/yr`;
  if (interval === "daily") return `$${dollars}/day`;
  return `$${dollars}`;
}

export function PanelMembership({
  membership,
}: {
  membership: DisplayMembershipTier;
}) {
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <div className="flex flex-wrap items-start justify-between gap-[2vw]">
        <h1 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-semibold text-brown">
          Membership
        </h1>
        <DisplayQr url={membership.joinUrl} size={140} label="Join" />
      </div>
      <ul className="grid min-h-0 flex-1 grid-cols-1 content-start gap-[1.4vh] overflow-hidden md:grid-cols-2">
        {membership.products.map((p) => (
          <li
            key={p.id}
            className="border-b border-border/70 pb-[1.2vh] last:border-0"
          >
            <p className="font-display text-[clamp(1.2rem,2.1vw,1.9rem)] font-semibold text-brown">
              {p.name}{" "}
              <span className="text-primary-text">
                {priceLabel(p.priceCents, p.billingInterval)}
              </span>
            </p>
            <p className="mt-[0.4vh] font-display text-[clamp(0.9rem,1.4vw,1.2rem)] text-secondary">
              {p.summary}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
