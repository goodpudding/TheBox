"use client";

import type { DisplayUpcomingItem } from "@/lib/data";
import { DisplayQr } from "./display-qr";

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PanelUpcoming({ items }: { items: DisplayUpcomingItem[] }) {
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <h1 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-semibold text-brown">
        Coming up
      </h1>
      <ul className="grid min-h-0 flex-1 grid-cols-1 content-start gap-[1.5vh] overflow-hidden md:grid-cols-2">
        {items.slice(0, 8).map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-[1.5vw] border-b border-border/70 pb-[1.2vh]"
          >
            <div className="min-w-0">
              <p className="font-display text-[clamp(1.15rem,2vw,1.8rem)] font-semibold text-brown">
                {item.title}
              </p>
              <p className="font-display text-[clamp(0.95rem,1.5vw,1.3rem)] text-secondary">
                {whenLabel(item.startsAt)} · {item.location}
              </p>
              <p className="font-display text-[clamp(0.9rem,1.4vw,1.2rem)] text-secondary">
                {item.spotsRemaining} spot{item.spotsRemaining === 1 ? "" : "s"}{" "}
                left
              </p>
            </div>
            <DisplayQr url={item.bookingUrl} size={110} label={`Book ${item.title}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
