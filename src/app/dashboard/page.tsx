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
  ClassInterestBoardView,
  ClassSession,
  OrgSettings,
  PendingCheckoff,
  Reservation,
  UsageSession,
  UserCertificationView,
} from "@/lib/data";
import { PendingCheckoffQueue } from "@/components/pending-checkoff-queue";

type Callout = {
  tone: "warn" | "danger" | "info";
  text: string;
  href?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function DashboardPage() {
  return (
    <MemberGate>
      <DashboardBody />
    </MemberGate>
  );
}

function DashboardBody() {
  const { provider, currentUser, revision, bump } = useData();
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
  const [interestMine, setInterestMine] = useState<ClassInterestBoardView[]>(
    [],
  );
  const [waiverOk, setWaiverOk] = useState(false);
  const [championProgress, setChampionProgress] = useState<{
    completedCount: number;
    shopLeadEligible: boolean;
    canScheduleMaintenance: boolean;
  } | null>(null);
  const [pendingCheckoffs, setPendingCheckoffs] = useState<PendingCheckoff[]>(
    [],
  );
  const [showCheckoffQueue, setShowCheckoffQueue] = useState(false);

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

      const myBoards = await provider.listInterestBoards({
        proposedByUserId: currentUser.id,
      });
      setInterestMine(myBoards);
      for (const board of myBoards) {
        if (board.status === "expired") {
          notes.push({
            tone: "info",
            text: `“${board.title}” didn’t hit ${board.threshold} pre-signups. You can resuggest it for another round.`,
            href: `/interest`,
            actionLabel: "Resuggest",
            onAction: () => {
              void (async () => {
                await provider.resuggestInterestBoard(
                  board.id,
                  currentUser.id,
                );
                bump();
              })();
            },
          });
        } else if (board.status === "ready") {
          notes.push({
            tone: "info",
            text: `“${board.title}” hit the interest threshold — staff can schedule it.`,
            href: "/interest",
          });
        } else if (board.status === "open") {
          notes.push({
            tone: "info",
            text: `Your interest board “${board.title}” is open (${board.interestCount}/${board.threshold}).`,
            href: `/interest/${board.id}`,
          });
        } else if (board.status === "pending") {
          notes.push({
            tone: "info",
            text: `Your class idea “${board.title}” is awaiting staff review.`,
            href: "/interest",
          });
        } else if (
          board.status === "scheduled" &&
          board.scheduledClassSessionId
        ) {
          notes.push({
            tone: "info",
            text: `“${board.title}” was scheduled — priority booking may be open for the interest list.`,
            href: `/classes/${board.scheduledClassSessionId}`,
          });
        }
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
            text: `${c.certification.name}: knowledge test passed — awaiting hands-on checkoff.`,
            href: "/learn",
          });
        } else if (c.status === "expired") {
          notes.push({
            tone: "warn",
            text: `${c.certification.name} certification expired.`,
            href: "/learn",
          });
        } else {
          notes.push({
            tone: "info",
            text: `${c.certification.name} expires ${c.expiresAt ? formatDateTime(c.expiresAt) : "soon"}.`,
            href: "/learn",
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

      const isStaff =
        currentUser.role === "staff" || currentUser.role === "admin";
      const showQueue =
        isStaff || champ.activeMachineIds.length > 0;
      setShowCheckoffQueue(showQueue);
      if (showQueue) {
        setPendingCheckoffs(
          await provider.listPendingCheckoffs(currentUser.id),
        );
      } else {
        setPendingCheckoffs([]);
      }
      setCallouts(notes);
    })();
  }, [currentUser, provider, revision]);

  if (!currentUser) return null;

  const sessionCount = recentUsage.length;
  const roleEyebrow =
    currentUser.role === "admin"
      ? "Admin dashboard"
      : currentUser.role === "staff"
        ? "Staff dashboard"
        : "Your dashboard";

  return (
    <PageShell>
      <PageHero
        eyebrow={roleEyebrow}
        title={`Hi, ${currentUser.firstName}`}
        description="Your membership, skills progress, and what’s next in the shop."
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <StatusPill
          tone={
            currentUser.role === "admin"
              ? "danger"
              : currentUser.role === "staff"
                ? "warn"
                : "ok"
          }
        >
          {currentUser.role === "admin"
            ? "Admin account"
            : currentUser.role === "staff"
              ? "Staff account"
              : "Member account"}
        </StatusPill>
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

      <section className="mt-10 rounded-[1.75rem] border border-primary/25 bg-primary/10 px-5 py-6 sm:px-7">
        <p className="eyebrow">Your stuff</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-brown">
          Personal links &amp; stats
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-secondary leading-relaxed">
          These pages are about you — not the public site. Track time on
          machines, skills, and account settings here.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/usage">
              Usage
              {sessionCount > 0 ? ` · ${sessionCount} recent` : ""}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/learn">Skills &amp; learn</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account">Account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/interest">
              Interest
              {interestMine.length > 0 ? ` · ${interestMine.length}` : ""}
            </Link>
          </Button>
          {championProgress?.canScheduleMaintenance ? (
            <Button asChild variant="outline">
              <Link href="/maintenance">Maintenance</Link>
            </Button>
          ) : null}
        </div>
      </section>

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
              ) : c.onAction ? (
                <span className="flex flex-wrap items-center gap-3">
                  <span>{c.text}</span>
                  <button
                    type="button"
                    className="font-display text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
                    onClick={c.onAction}
                  >
                    {c.actionLabel ?? "Continue"}
                  </button>
                </span>
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
          <p className="eyebrow">Skills progress</p>
          <Link
            href="/learn"
            className="font-display text-sm text-primary-text hover:underline"
          >
            Open Learn
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
            <Link href="/learn" className="text-primary-text underline">
              Start with Shop Orientation
            </Link>
            .
          </p>
        )}
      </section>

      {showCheckoffQueue ? (
        <section className="mt-12">
          <p className="eyebrow">Ready for checkoff</p>
          <p className="mt-2 max-w-xl text-sm text-secondary leading-relaxed">
            {currentUser.role === "staff" || currentUser.role === "admin"
              ? "Members who passed a knowledge quiz and need hands-on checkoff."
              : "Members waiting on checkoff for machines you champion. You can record checkoff for those certs."}
            {pendingCheckoffs.length > 0
              ? ` ${pendingCheckoffs.length} waiting.`
              : ""}
          </p>
          <PendingCheckoffQueue
            className="mt-4"
            memberHref={
              currentUser.role === "staff" || currentUser.role === "admin"
                ? (id) => `/admin/members/${id}`
                : undefined
            }
            allowInlineCheckoff
            emptyMessage="No one is waiting on checkoff for your machines right now."
          />
        </section>
      ) : null}

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow">Recent machine sessions</p>
          <Link
            href="/usage"
            className="font-display text-sm text-primary-text hover:underline"
          >
            Full history &amp; monthly totals
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
