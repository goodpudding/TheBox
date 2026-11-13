"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/providers";
import { DisplayShell } from "@/components/display/display-shell";
import { PanelToday } from "@/components/display/panel-today";
import { PanelMachines } from "@/components/display/panel-machines";
import { PanelUpcoming } from "@/components/display/panel-upcoming";
import { PanelCerts } from "@/components/display/panel-certs";
import { PanelPromos } from "@/components/display/panel-promos";
import { PanelMembership } from "@/components/display/panel-membership";
import { PanelBounties } from "@/components/display/panel-bounties";
import type { DisplayFeed, DisplayPanelId } from "@/lib/data";
import { laParts } from "@/lib/data/display-feed";

const POLL_MS = 60_000;
const FETCH_TIMEOUT_MS = 20_000;
const NIGHTLY_RELOAD_HOUR = 4;

type FeedResult =
  | { status: "ok"; feed: DisplayFeed }
  | { status: "denied" }
  | { status: "failed" };

/** One read of the feed. A timeout or a bad answer is "failed", not a throw. */
async function fetchFeed(token: string): Promise<FeedResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `/api/display/feed?token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: controller.signal },
    );
    if (res.status === 401) return { status: "denied" };
    if (!res.ok) return { status: "failed" };
    return { status: "ok", feed: (await res.json()) as DisplayFeed };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function panelHasContent(id: DisplayPanelId, feed: DisplayFeed): boolean {
  switch (id) {
    case "today":
      return (
        feed.todaySessions.length > 0 || feed.todayReservations.length > 0
      );
    case "machines":
      return feed.machines.length > 0;
    case "upcoming":
      return feed.upcoming.length > 0;
    case "certs":
      return feed.checkoffs.length > 0 || feed.onlineCerts.length > 0;
    case "bounties":
      return (feed.bounties?.length ?? 0) > 0;
    case "promos":
      return feed.promos.length > 0;
    case "membership":
      return feed.membership.products.length > 0;
  }
}

function buildRotation(feed: DisplayFeed, cycle: number): DisplayPanelId[] {
  const { panelOrder, pinnedPanel, membershipEveryNRotations } = feed.config;
  const everyN = Math.max(1, membershipEveryNRotations);
  const includeMembership = cycle % everyN === 0;

  let order = panelOrder.filter((id) => {
    if (id === "membership" && !includeMembership) return false;
    return panelHasContent(id, feed);
  });

  if (pinnedPanel && panelHasContent(pinnedPanel, feed)) {
    order = [pinnedPanel, ...order.filter((id) => id !== pinnedPanel)];
  }

  return order;
}

export default function DisplayClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { revision } = useData();

  const [feed, setFeed] = useState<DisplayFeed | null>(null);
  const [feedDenied, setFeedDenied] = useState(false);
  // When the feed last loaded. Read only to say how stale it is, never shown.
  const fetchedAtRef = useRef<number | null>(null);
  const [staleMinutes, setStaleMinutes] = useState<number | null>(null);
  const [panelIndex, setPanelIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [promoIndex, setPromoIndex] = useState(0);
  const [nowTick, setNowTick] = useState(0);

  // No token in the address is a refusal before any request is made.
  const denied = !token || feedDenied;

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const load = () =>
      fetchFeed(token).then((result) => {
        if (stopped) return;
        if (result.status === "denied") {
          setFeedDenied(true);
        } else if (result.status === "ok") {
          setFeed(result.feed);
          fetchedAtRef.current = Date.now();
          setStaleMinutes(null);
          setFeedDenied(false);
        } else {
          // Keep the last feed on screen and say how old it is.
          const fetchedAt = fetchedAtRef.current;
          if (fetchedAt != null) {
            setStaleMinutes(
              Math.max(1, Math.round((Date.now() - fetchedAt) / 60_000)),
            );
          }
        }
      });
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(poll);
    };
  }, [token, revision]);

  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (laParts(new Date()).hour === NIGHTLY_RELOAD_HOUR) {
        window.location.reload();
      }
    }, 30 * 60_000);
    return () => clearInterval(id);
  }, []);

  const rotation = useMemo(
    () => (feed ? buildRotation(feed, cycle) : []),
    [feed, cycle],
  );

  const cadenceMs = (feed?.config.cadenceSeconds ?? 12) * 1000;

  useEffect(() => {
    if (!feed || rotation.length === 0) return;
    const t = setInterval(() => {
      setPanelIndex((i) => {
        const next = i + 1;
        if (next >= rotation.length) {
          setCycle((c) => c + 1);
          setPromoIndex((p) => p + 1);
          return 0;
        }
        return next;
      });
    }, cadenceMs);
    return () => clearInterval(t);
  }, [feed, rotation.length, cadenceMs]);

  void nowTick;

  if (denied) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-page">
        <p className="font-display text-2xl text-brown">Display unavailable</p>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-page">
        <p className="font-display text-2xl text-secondary">Loading…</p>
      </div>
    );
  }

  const activeId = rotation[panelIndex % Math.max(rotation.length, 1)];
  const promoSlide =
    feed.promos.length > 0
      ? [feed.promos[promoIndex % feed.promos.length]!]
      : [];

  return (
    <div className="fixed inset-0 z-[100]">
      <DisplayShell feed={feed} staleMinutes={staleMinutes}>
        {activeId === "today" ? <PanelToday feed={feed} /> : null}
        {activeId === "machines" ? (
          <PanelMachines machines={feed.machines} />
        ) : null}
        {activeId === "upcoming" ? (
          <PanelUpcoming items={feed.upcoming} />
        ) : null}
        {activeId === "certs" ? (
          <PanelCerts
            checkoffs={feed.checkoffs}
            onlineCerts={feed.onlineCerts}
          />
        ) : null}
        {activeId === "bounties" ? (
          <PanelBounties bounties={feed.bounties ?? []} />
        ) : null}
        {activeId === "promos" ? <PanelPromos slides={promoSlide} /> : null}
        {activeId === "membership" ? (
          <PanelMembership membership={feed.membership} />
        ) : null}
        {rotation.length === 0 ? (
          <p className="font-display text-[clamp(1.2rem,2vw,1.8rem)] text-secondary">
            Nothing scheduled to show right now.
          </p>
        ) : null}
      </DisplayShell>
    </div>
  );
}
