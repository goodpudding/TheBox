"use client";

import type { DisplayCheckoff, DisplayOnlineCert } from "@/lib/data";
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
  const qrTarget = learnUrl();

  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <div className="flex flex-wrap items-start justify-between gap-[2vw]">
        <h1 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-semibold text-brown">
          Get certified
        </h1>
        <div className="flex items-center gap-[1vw]">
          <p className="max-w-[20vw] font-display text-[clamp(0.9rem,1.4vw,1.2rem)] text-secondary">
            Start online learning
          </p>
          <DisplayQr url={qrTarget} size={120} label="Learn" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[2vw] lg:grid-cols-2">
        <section>
          <h2 className="font-display text-[clamp(1.1rem,2vw,1.8rem)] font-semibold text-secondary">
            Upcoming checkoffs
          </h2>
          {checkoffs.length === 0 ? (
            <p className="mt-[1vh] font-display text-[clamp(1rem,1.6vw,1.3rem)] text-secondary">
              No checkoff sessions in the next week.
            </p>
          ) : (
            <ul className="mt-[1.2vh] space-y-[1vh]">
              {checkoffs.map((c) => (
                <li key={c.id}>
                  <p className="font-display text-[clamp(1.15rem,2vw,1.7rem)] font-semibold text-brown">
                    {c.title}
                  </p>
                  <p className="font-display text-[clamp(0.95rem,1.5vw,1.25rem)] text-secondary">
                    {whenLabel(c.startsAt)} · {c.location} · {c.spotsRemaining}{" "}
                    left
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="font-display text-[clamp(1.1rem,2vw,1.8rem)] font-semibold text-secondary">
            Start online
          </h2>
          <ul className="mt-[1.2vh] space-y-[0.8vh]">
            {onlineCerts.map((c) => (
              <li
                key={c.certificationId}
                className="font-display text-[clamp(1.1rem,1.9vw,1.6rem)] font-semibold text-brown"
              >
                {c.name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
