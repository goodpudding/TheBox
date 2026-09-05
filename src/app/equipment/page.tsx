"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import type { Machine, MachineArea } from "@/lib/data";

const AREA_ORDER: MachineArea[] = [
  "3d_printing",
  "laser",
  "woodshop",
  "textiles_vinyl",
  "sublimation",
];

const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
};

export default function EquipmentIndexPage() {
  const { provider, revision } = useData();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await provider.listMachines();
      if (cancelled) return;
      setMachines(list.filter((m) => m.active));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const grouped = useMemo(
    () =>
      AREA_ORDER.map((area) => ({
        area,
        label: AREA_LABEL[area],
        machines: machines
          .filter((m) => m.area === area)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })).filter((g) => g.machines.length > 0),
    [machines],
  );

  return (
    <PageShell>
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <PageHero
          eyebrow="Shop floor"
          title="Equipment"
          description="Everything available in The Box and where it lives. Scan the QR on a machine for certifications, a getting-started video, and reservations."
        />
        <div className="relative aspect-[16/10] overflow-hidden bg-brown/10 lg:mb-1">
          <Image
            src="/images/the-box-doors.jpg"
            alt="The Box Maker Space doors"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-center"
            priority
          />
        </div>
      </div>

      {loading ? (
        <p className="mt-12 text-secondary">Loading equipment…</p>
      ) : grouped.length === 0 ? (
        <p className="mt-12 text-secondary">No active equipment listed yet.</p>
      ) : (
        <div className="mt-12 space-y-12">
          {grouped.map((group) => (
            <section key={group.area}>
              <h2 className="font-display text-xl font-semibold text-brown">
                {group.label}
              </h2>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {group.machines.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/equipment/${m.id}`}
                      className="group flex flex-wrap items-baseline justify-between gap-3 py-5"
                    >
                      <div className="min-w-0">
                        <span className="font-display text-lg font-semibold text-brown transition-colors group-hover:text-primary-text">
                          {m.name}
                        </span>
                        {m.locationLabel ? (
                          <p className="mt-1 text-sm text-secondary">
                            {m.locationLabel}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.requiredCertificationIds.length > 0 ? (
                            <StatusPill tone="info">Cert required</StatusPill>
                          ) : null}
                          {m.reservationRequired ? (
                            <StatusPill tone="warn">
                              Reservation required
                            </StatusPill>
                          ) : m.reservationRecommended ? (
                            <StatusPill tone="info">
                              Reservation recommended
                            </StatusPill>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 font-display text-sm text-secondary">
                        Details →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
