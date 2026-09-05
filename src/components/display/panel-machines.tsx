"use client";

import type { DisplayMachineStatus } from "@/lib/data";

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusCopy(m: DisplayMachineStatus): string {
  switch (m.status) {
    case "available":
      return "Available";
    case "in_use":
      return m.since
        ? `In use · since ${timeLabel(m.since)}${m.displayName ? ` · ${m.displayName}` : ""}`
        : "In use";
    case "reserved":
      return m.reservedAt ? `Reserved at ${timeLabel(m.reservedAt)}` : "Reserved";
    case "maintenance":
      return "Down for maintenance";
  }
}

function statusTone(status: DisplayMachineStatus["status"]): string {
  switch (status) {
    case "available":
      return "border-primary/30 bg-primary/10";
    case "in_use":
      return "border-brown/25 bg-surface";
    case "reserved":
      return "border-border bg-white/50";
    case "maintenance":
      return "border-brown/40 bg-brown/10";
  }
}

export function PanelMachines({
  machines,
}: {
  machines: DisplayMachineStatus[];
}) {
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <h1 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-semibold text-brown">
        Machine status
      </h1>
      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-[1.2vw] overflow-hidden md:grid-cols-3 xl:grid-cols-4">
        {machines.map((m) => (
          <div
            key={m.id}
            className={`rounded-[1vw] border px-[1.2vw] py-[1.4vh] ${statusTone(m.status)}`}
          >
            <p className="font-display text-[clamp(1rem,1.8vw,1.6rem)] font-semibold leading-tight text-brown">
              {m.name}
            </p>
            <p className="mt-[0.8vh] font-display text-[clamp(0.85rem,1.35vw,1.2rem)] text-secondary">
              {statusCopy(m)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
