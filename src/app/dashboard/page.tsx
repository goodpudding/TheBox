"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { formatTier } from "@/lib/utils";
import { SHOP_LEAD_COMPLETED_TOOLS } from "@/lib/data";
import type {
  Booking,
  ClassSession,
  OrgSettings,
  Reservation,
  UsageSession,
  UserCertificationView,
} from "@/lib/data";

type Callout = { tone: "warn" | "danger" | "info"; text: string; href?: string };

export default function DashboardPage() {
  return (
    <MemberGate>
      <DashboardBody />
    </MemberGate>
  );
}

function DashboardBody() {
  const { provider, currentUser, revision } = useData();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [certs, setCerts] = useState<UserCertificationView[]>([]);
  const [nextReservation, setNextReservation] = useState<
    (Reservation & { machineName?: string }) | null
  >(null);
  const [nextClass, setNextClass] = useState<{
    booking: Booking;
    session: ClassSession;
  } | null>(null);
  const [recentUsage, setRecentUsage] = useState<
    (UsageSession & { machineName?: string })[]
  >([]);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [waiverOk, setWaiverOk] = useState(false);
  const [championProgress, setChampionProgress] = useState<{
    completedCount: number;
    shopLeadEligible: boolean;
    canScheduleMaintenance: boolean;
  } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      const s = await provider.getSettings();
      setSettings(s);
      const ob = await provider.getOnboardingState(currentUser.id);
      setWaiverOk(ob.waiverSignedCurrent);

      const certList = await provider.getCertifications(currentUser.id);
      setCerts(certList.filter((c) => c.status === "certified"));

      const machines = await provider.listMachines();
      const machineMap = Object.fromEntries(machines.map((m) => [m.id, m]));

      const reservations = await provider.listReservations({
        userId: currentUser.id,
        status: "booked",
      });
      const upcomingRes = reservations
        .filter((r) => new Date(r.startsAt).getTime() >= Date.now())
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0];
      setNextReservation(
        upcomingRes
          ? {
              ...upcomingRes,
              machineName: machineMap[upcomingRes.machineId]?.name,
            }
          : null,
      );

      const bookings = await provider.listBookingsForUser(currentUser.id);
      const classes = await provider.listClasses({ upcomingOnly: true });
      const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
      const nextBk = bookings
        .filter((b) =>
          ["booked", "awaiting_payment", "waitlisted"].includes(b.status),
        )
        .map((b) => ({ booking: b, session: classMap[b.classSessionId] }))
        .filter((x) => x.session)
        .sort(
          (a, b) =>
            new Date(a.session.startsAt).getTime() -
            new Date(b.session.startsAt).getTime(),
        )[0];
      setNextClass(nextBk ?? null);

      const usage = await provider.getUsage(currentUser.id);
      setRecentUsage(
        usage
          .slice()
          .sort(
            (a, b) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          )
          .slice(0, 5)
          .map((u) => ({
            ...u,
            machineName: machineMap[u.machineId]?.name,
          })),
      );

      const notes: Callout[] = [];
      if (currentUser.status === "lapsed") {
        notes.push({
          tone: "danger",
          text: "Membership lapsed — renew via billing to restore shop access.",
          href: s.paymentUrl,
        });
      }
      if (currentUser.status === "suspended") {
        notes.push({
          tone: "danger",
          text: "Account suspended. Contact staff before using machines.",
        });
      }
      if (!ob.waiverSignedCurrent) {
        notes.push({
          tone: "warn",
          text: "Waiver needs a current signature.",
          href: "/onboarding/waiver",
        });
      }
      if (!ob.expectationsAcknowledged) {
        notes.push({
          tone: "warn",
          text: "Member expectations need acknowledgement.",
          href: "/onboarding/expectations",
        });
      }
      if (!currentUser.shopAccess) {
        notes.push({
          tone: "info",
          text: "Friend of The Box — no shop machine access on this tier.",
          href: "/join",
        });
      }
      const unpaid = bookings.find((b) => b.status === "awaiting_payment");
      if (unpaid) {
        notes.push({
          tone: "warn",
          text: "You have a class booking awaiting payment confirmation.",
        });
      }
      const expiring = certList.filter(
        (c) =>
          c.status === "expired" ||
          c.status === "knowledge_passed" ||
          (c.expiresAt &&
            new Date(c.expiresAt).getTime() - Date.now() <
              1000 * 60 * 60 * 24 * 45 &&
            c.status === "certified"),
      );
      for (const c of expiring.slice(0, 3)) {
        if (c.status === "knowledge_passed") {
          notes.push({
            tone: "info",
            text: `${c.certification.name}: knowledge test passed — book a hands-on checkoff.`,
            href: "/certifications",
          });
        } else if (c.status === "expired") {
          notes.push({
            tone: "warn",
            text: `${c.certification.name} certification expired.`,
            href: "/certifications",
          });
        } else {
          notes.push({
            tone: "info",
            text: `${c.certification.name} expires ${c.expiresAt ? formatDateTime(c.expiresAt) : "soon"}.`,
            href: "/certifications",
          });
        }
      }
      if (currentUser.dayPassCreditExpiresAt) {
        notes.push({
          tone: "info",
          text: `Day-pass join credit open until ${formatDateTime(currentUser.dayPassCreditExpiresAt)}.`,
          href: "/join",
        });
      }
      if (currentUser.scholarshipExpiresAt) {
        notes.push({
          tone: "info",
          text: `Scholarship seat runs through ${formatDateTime(currentUser.scholarshipExpiresAt)}.`,
        });
      }
      const champ = await provider.getToolChampionProgress(currentUser.id);
      setChampionProgress({
        completedCount: champ.completedCount,
        shopLeadEligible: champ.shopLeadEligible,
        canScheduleMaintenance: champ.canScheduleMaintenance,
      });
      if (champ.shopLeadEligible) {
        notes.push({
          tone: "info",
          text: "Shop lead track unlocked — talk with staff about floor leadership.",
          href: "/volunteer",
        });
      } else if (champ.completedCount > 0 || champ.activeMachineIds.length > 0) {
        notes.push({
          tone: "info",
          text: `Tool Champion progress: ${champ.completedCount}/${SHOP_LEAD_COMPLETED_TOOLS} machines completed.`,
          href: "/volunteer",
        });
      }
      setCallouts(notes);
    })();
  }, [currentUser, provider, revision]);

  if (!currentUser) return null;

  return (
    <PageShell>
      <PageHero
        eyebrow="Dashboard"
        title={`Hi, ${currentUser.firstName}`}
        description="Your membership, certifications, and what’s next in the shop."
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <StatusPill
          tone={
            currentUser.status === "active"
              ? "ok"
              : currentUser.status === "pending"
                ? "info"
                : "danger"
          }
        >
          {currentUser.status}
        </StatusPill>
        <StatusPill tone="info">{formatTier(currentUser.tier)}</StatusPill>
        <StatusPill tone={waiverOk ? "ok" : "warn"}>
          {waiverOk ? "Waiver current" : "Waiver action needed"}
        </StatusPill>
        {!currentUser.shopAccess ? (
          <StatusPill tone="muted">No shop access</StatusPill>
        ) : null}
      </div>

      {callouts.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {callouts.map((c, i) => (
            <li
              key={`${c.text}-${i}`}
              className={
                c.tone === "danger"
                  ? "rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
                  : c.tone === "warn"
                    ? "rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-brown"
                    : "rounded-2xl border border-border bg-surface px-4 py-3 text-charcoal"
              }
            >
              {c.href?.startsWith("http") ? (
                <a href={c.href} className="underline-offset-2 hover:underline">
                  {c.text}
                </a>
              ) : c.href ? (
                <Link href={c.href} className="underline-offset-2 hover:underline">
                  {c.text}
                </Link>
              ) : (
                c.text
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section>
          <p className="eyebrow">Next reservation</p>
          {nextReservation ? (
            <div className="mt-3">
              <h2 className="font-display text-xl font-semibold text-brown">
                {nextReservation.machineName ?? "Machine"}
              </h2>
              <p className="mt-1 text-secondary">
                {formatDateTime(nextReservation.startsAt)} –{" "}
                {formatDateTime(nextReservation.endsAt)}
              </p>
              <p className="mt-2 text-sm text-secondary">
                Priority at slot start — not exclusive lockout.{" "}
                <Link href="/reserve" className="text-primary-text underline">
                  Manage reservations
                </Link>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-secondary">No upcoming reservations.</p>
          )}
        </section>

        <section>
          <p className="eyebrow">Next class</p>
          {nextClass ? (
            <div className="mt-3">
              <h2 className="font-display text-xl font-semibold text-brown">
                {nextClass.session.title}
              </h2>
              <p className="mt-1 text-secondary">
                {formatDateTime(nextClass.session.startsAt)}
              </p>
              <StatusPill
                className="mt-3"
                tone={
                  nextClass.booking.status === "awaiting_payment"
                    ? "warn"
                    : nextClass.booking.status === "waitlisted"
                      ? "info"
                      : "ok"
                }
              >
                {nextClass.booking.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
          ) : (
            <p className="mt-3 text-secondary">No upcoming class bookings.</p>
          )}
        </section>
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow">Active certifications</p>
          <Link
            href="/certifications"
            className="font-display text-sm text-primary-text hover:underline"
          >
            View all
          </Link>
        </div>
        {certs.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {certs.map((c) => (
              <li key={c.id}>
                <StatusPill tone="ok">{c.certification.name}</StatusPill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">
            None yet.{" "}
            <Link href="/certifications" className="text-primary-text underline">
              Start with Shop Orientation
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow">Recent machine sessions</p>
          <Link
            href="/usage"
            className="font-display text-sm text-primary-text hover:underline"
          >
            Full history
          </Link>
        </div>
        {recentUsage.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {recentUsage.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <span className="font-display font-medium text-brown">
                  {u.machineName ?? u.machineId}
                </span>
                <span className="text-sm text-secondary">
                  {formatDateTime(u.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">No sessions logged yet.</p>
        )}
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        {championProgress?.canScheduleMaintenance ? (
          <Button asChild>
            <Link href="/maintenance">Schedule maintenance</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href="/account">Account</Link>
        </Button>
        <Button asChild variant="outline">
          <a
            href={settings?.paymentUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Manage billing
          </a>
        </Button>
      </div>
    </PageShell>
  );
}
