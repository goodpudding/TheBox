"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type {
  Certification,
  LearningModuleView,
  Machine,
  MachineArea,
} from "@/lib/data";

const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
};

export default function EquipmentDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { provider, revision } = useData();
  const [machine, setMachine] = useState<Machine | null | undefined>(undefined);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [modules, setModules] = useState<LearningModuleView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [machines, certificationList, moduleList] = await Promise.all([
        provider.listMachines(),
        provider.listCertifications(),
        provider.listModules(),
      ]);
      if (cancelled) return;
      setMachine(machines.find((m) => m.id === id) ?? null);
      setCerts(certificationList);
      setModules(moduleList);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision, id]);

  const requiredCerts = useMemo(() => {
    if (!machine) return [];
    return machine.requiredCertificationIds
      .map((certId) => certs.find((c) => c.id === certId))
      .filter((c): c is Certification => Boolean(c));
  }, [machine, certs]);

  const moduleByCert = useMemo(() => {
    const map = new Map<string, LearningModuleView>();
    for (const mod of modules) {
      map.set(mod.certificationId, mod);
    }
    return map;
  }, [modules]);

  const embedUrl = machine?.gettingStartedVideoUrl
    ? toEmbedUrl(machine.gettingStartedVideoUrl)
    : null;

  if (machine === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading equipment…</p>
      </PageShell>
    );
  }

  if (machine === null) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Equipment"
          title="Not found"
          description="That machine isn’t in the catalog. Check the sticker or browse the full list."
        />
        <Button asChild className="mt-8">
          <Link href="/equipment">Browse equipment</Link>
        </Button>
      </PageShell>
    );
  }

  const needsReserve =
    machine.reservationRequired || machine.reservationRecommended;
  const openUse =
    requiredCerts.length === 0 &&
    !machine.reservationRequired &&
    !machine.reservationRecommended;

  return (
    <PageShell>
      <PageHero
        eyebrow={AREA_LABEL[machine.area]}
        title={machine.name}
        description={
          machine.locationLabel
            ? `Located at ${machine.locationLabel}.`
            : "Shop equipment details, certifications, and how to get started."
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {requiredCerts.length > 0 ? (
          <StatusPill tone="info">Cert required</StatusPill>
        ) : null}
        {machine.reservationRequired ? (
          <StatusPill tone="warn">Reservation required</StatusPill>
        ) : machine.reservationRecommended ? (
          <StatusPill tone="info">Reservation recommended</StatusPill>
        ) : null}
        {openUse ? <StatusPill tone="ok">Open use</StatusPill> : null}
      </div>

      {openUse ? (
        <p className="mt-8 max-w-2xl text-secondary">
          Open use — no certifications or reservations are required to start
          this machine (membership, waiver, and badge rules still apply).
        </p>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Certifications
        </h2>
        {requiredCerts.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">
            No machine-specific certifications required.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {requiredCerts.map((cert) => {
              const mod = moduleByCert.get(cert.id);
              return (
                <li
                  key={cert.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-display font-semibold text-brown">
                      {cert.name}
                    </p>
                    {cert.description ? (
                      <p className="mt-1 max-w-xl text-sm text-secondary">
                        {cert.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mod ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/learn/${mod.slug}`}>Start learning</Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm">
                      <Link href="/certifications">View certs</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Getting started
        </h2>
        {machine.gettingStartedVideoUrl ? (
          <div className="mt-4 space-y-4">
            {embedUrl ? (
              <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-charcoal/5">
                <iframe
                  title={`${machine.name} getting started`}
                  src={embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
            <p>
              <a
                href={machine.gettingStartedVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-display text-sm font-medium text-primary-text underline-offset-4 hover:underline"
              >
                Open video in a new tab →
              </a>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-secondary">
            No getting-started video has been added for this machine yet.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">
          Reservation
        </h2>
        {needsReserve ? (
          <div className="mt-4 max-w-xl space-y-4">
            <p className="text-sm text-secondary">
              {machine.reservationRequired
                ? "A booked reservation that covers the current time is required before this machine will start."
                : "A reservation is recommended so other members know when you’ll be using it."}
            </p>
            <Button asChild>
              <Link href={`/reserve/${machine.id}`}>Reserve this machine</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-secondary">
            Reservations are optional for this machine. You can still book a
            slot if you want a guaranteed window.
          </p>
        )}
        {!needsReserve ? (
          <div className="mt-4">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/reserve/${machine.id}`}>Reserve anyway</Link>
            </Button>
          </div>
        ) : null}
      </section>

      <p className="mt-14">
        <Link
          href="/equipment"
          className="font-display text-sm text-secondary hover:text-brown"
        >
          ← All equipment
        </Link>
      </p>
    </PageShell>
  );
}

function toEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const embedMatch = url.pathname.match(/\/embed\/([^/]+)/);
      if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
