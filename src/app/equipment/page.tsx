"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { inventoryPhotoSrc } from "@/components/inventory-photo";
import { TextBlock } from "@/components/text-block";
import type { Machine, MachineArea, PublicEquipmentItem } from "@/lib/data";

const AREA_ORDER: MachineArea[] = [
  "3d_printing",
  "laser",
  "woodshop",
  "textiles_vinyl",
  "sublimation",
  "cnc_plasma",
  "hand_tools",
];

const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
  cnc_plasma: "CNC & plasma",
  hand_tools: "Hand tools",
};

/** "DeWalt DWE6423", or whichever of the two there is. */
function makeAndModel(item: PublicEquipmentItem): string {
  return [item.manufacturer, item.model].filter(Boolean).join(" ");
}

/** The list arrives in the areas' order. This keeps that order while grouping. */
function byArea(
  items: PublicEquipmentItem[],
): Array<{ key: string; name: string; items: PublicEquipmentItem[] }> {
  const groups: Array<{ key: string; name: string; items: PublicEquipmentItem[] }> = [];
  for (const item of items) {
    const key = item.area?.id ?? "";
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, name: item.area?.name ?? "Around the shop", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export default function EquipmentIndexPage() {
  const { provider, revision } = useData();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [equipment, setEquipment] = useState<PublicEquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      // Two requests for the whole page: the machines to reserve, and the
      // shop's equipment with its photos. A failed one leaves its part empty.
      const [list, shop] = await Promise.all([
        provider.listMachines().catch(() => [] as Machine[]),
        provider.listPublicEquipment().catch(() => [] as PublicEquipmentItem[]),
      ]);
      if (cancelled) return;
      setMachines(list.filter((m) => m.active));
      setEquipment(shop);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const shopAreas = useMemo(() => byArea(equipment), [equipment]);
  // Under "Machines to reserve" when both lists show; a top heading otherwise.
  const MachineAreaHeading = shopAreas.length > 0 ? "h3" : "h2";

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
          description={<TextBlock slug="equipment-hero" as="span" />}
        />
        <div className="relative aspect-[16/10] overflow-hidden bg-brown/10 lg:mb-1">
          <Image
            src="/images/the-box-doors.jpg"
            alt="The makerspace doors"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-center"
            priority
          />
        </div>
      </div>

      {loading ? (
        <p className="mt-12 text-secondary">Loading equipment…</p>
      ) : grouped.length === 0 && shopAreas.length === 0 ? (
        <p className="mt-12 text-secondary">No equipment listed yet.</p>
      ) : null}

      {!loading && shopAreas.length > 0 ? (
        <section className="mt-12" aria-labelledby="shop-equipment">
          <h2
            id="shop-equipment"
            className="font-display text-2xl font-semibold text-brown"
          >
            In the shop
          </h2>
          <TextBlock
            slug="equipment-shop-intro"
            className="mt-2 max-w-2xl text-secondary"
          />
          <div className="mt-8 space-y-12">
            {shopAreas.map((group) => (
              <section key={group.key} aria-label={group.name}>
                <h3 className="font-display text-xl font-semibold text-brown">
                  {group.name}
                </h3>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {group.items.map((item, index) => {
                    const detail = makeAndModel(item);
                    const src = inventoryPhotoSrc(
                      item.photo?.thumbKey ?? item.photo?.storageKey,
                    );
                    return (
                      <li key={`${item.photo?.storageKey ?? item.name}-${index}`}>
                        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-brown/10">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={detail ? `${item.name}: ${detail}` : item.name}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="mt-3 font-display font-semibold text-brown">
                          {item.name}
                          {item.quantity ? (
                            <span className="font-normal text-secondary">
                              {" "}
                              × {item.quantity}
                            </span>
                          ) : null}
                        </p>
                        {detail ? (
                          <p className="mt-0.5 text-sm text-secondary">{detail}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && grouped.length > 0 ? (
        <div className="mt-16 space-y-12">
          {shopAreas.length > 0 ? (
            <h2 className="font-display text-2xl font-semibold text-brown">
              Machines to reserve
            </h2>
          ) : null}
          {grouped.map((group) => (
            <section key={group.area}>
              <MachineAreaHeading className="font-display text-xl font-semibold text-brown">
                {group.label}
              </MachineAreaHeading>
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
      ) : null}
    </PageShell>
  );
}
