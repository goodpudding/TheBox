"use client";

import type { DisplayFeed } from "@/lib/data";

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PanelToday({ feed }: { feed: DisplayFeed }) {
  const byMachine = new Map<string, typeof feed.todayReservations>();
  for (const r of feed.todayReservations) {
    const list = byMachine.get(r.machineId) ?? [];
    list.push(r);
    byMachine.set(r.machineId, list);
  }

  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <h1 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-semibold text-brown">
        Today at The Box
      </h1>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[2vw] lg:grid-cols-2">
        <section className="min-h-0 overflow-hidden">
          <h2 className="font-display text-[clamp(1.1rem,2vw,1.8rem)] font-semibold text-secondary">
            Classes & checkoffs
          </h2>
          {feed.todaySessions.length === 0 ? (
            <p className="mt-[1.5vh] font-display text-[clamp(1rem,1.6vw,1.4rem)] text-secondary">
              No sessions on the calendar today.
            </p>
          ) : (
            <ul className="mt-[1.5vh] space-y-[1.2vh]">
              {feed.todaySessions.map((s) => (
                <li
                  key={s.id}
                  className="border-b border-border/70 pb-[1vh] last:border-0"
                >
                  <p className="font-display text-[clamp(1.2rem,2.2vw,2rem)] font-semibold text-brown">
                    {timeLabel(s.startsAt)} · {s.title}
                  </p>
                  <p className="font-display text-[clamp(0.95rem,1.5vw,1.3rem)] text-secondary">
                    {s.location} · {s.spotsRemaining} spot
                    {s.spotsRemaining === 1 ? "" : "s"} left
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="min-h-0 overflow-hidden">
          <h2 className="font-display text-[clamp(1.1rem,2vw,1.8rem)] font-semibold text-secondary">
            Machine reservations
          </h2>
          {feed.todayReservations.length === 0 ? (
            <p className="mt-[1.5vh] font-display text-[clamp(1rem,1.6vw,1.4rem)] text-secondary">
              No machine reservations today.
            </p>
          ) : (
            <ul className="mt-[1.5vh] space-y-[1.4vh]">
              {[...byMachine.entries()].map(([machineId, rows]) => (
                <li key={machineId}>
                  <p className="font-display text-[clamp(1.1rem,1.9vw,1.7rem)] font-semibold text-brown">
                    {rows[0]?.machineName}
                  </p>
                  <div className="mt-[0.6vh] flex flex-wrap gap-[0.8vw]">
                    {rows.map((r) => (
                      <span
                        key={`${r.machineId}-${r.startsAt}`}
                        className="font-display text-[clamp(0.95rem,1.5vw,1.3rem)] text-secondary"
                      >
                        {timeLabel(r.startsAt)}
                        {r.displayName ? ` · ${r.displayName}` : ""}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
