"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/providers";
import { DisplayMap } from "@/components/display/display-map";
import { DisplayPhotoSide } from "@/components/display/display-photo";
import { DisplayShell } from "@/components/display/display-shell";
import {
  START_OF_ROTATION,
  advanceRotation,
} from "@/components/display/rotation";
import { PanelToday } from "@/components/display/panel-today";
import { PanelMachines } from "@/components/display/panel-machines";
import { PanelUpcoming } from "@/components/display/panel-upcoming";
import { PanelCerts } from "@/components/display/panel-certs";
import { PanelPromos } from "@/components/display/panel-promos";
import { PanelMembership } from "@/components/display/panel-membership";
import { PanelBounties } from "@/components/display/panel-bounties";
import { PanelCommunity } from "@/components/display/panel-community";
import { PanelFindUs } from "@/components/display/panel-findus";
import { PanelSpotlight } from "@/components/display/panel-spotlight";
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
    case "findus":
      return true;
    case "spotlight":
      return (feed.spotlight?.length ?? 0) > 0;
    case "community":
      return (feed.community?.length ?? 0) > 0;
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
  const [{ slide, panelIndex, cycle, promoIndex }, advance] = useReducer(
    advanceRotation,
    START_OF_ROTATION,
  );
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

  // Depends on whether there is a feed, not on which one: the feed is re-read
  // every minute, and restarting this timer each time would stretch the slide
  // on screen and stop a slide longer than a minute from ever changing.
  const ready = feed != null;
  useEffect(() => {
    if (!ready || rotation.length === 0) return;
    const t = setInterval(() => advance(rotation.length), cadenceMs);
    return () => clearInterval(t);
  }, [ready, rotation.length, cadenceMs]);

  // Fetch the next photo while this one is up, so the change is a fade and
  // not a picture loading top to bottom.
  const photos = feed?.photos;
  const nextPhotoUrl =
    photos && photos.length > 1
      ? photos[(slide + 1) % photos.length]!.url
      : null;
  useEffect(() => {
    if (!nextPhotoUrl) return;
    const preload = new Image();
    preload.src = nextPhotoUrl;
  }, [nextPhotoUrl]);

  void nowTick;

  if (denied) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-display-panel">
        <p className="font-display text-2xl text-display-ink">
          Display unavailable
        </p>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-display-panel">
        <p className="font-display text-2xl text-display-muted">Loading…</p>
      </div>
    );
  }

  const activeId = rotation[panelIndex % Math.max(rotation.length, 1)];
  const promo =
    feed.promos.length > 0
      ? feed.promos[promoIndex % feed.promos.length]!
      : null;
  const photoAt = (n: number) =>
    feed.photos.length > 0
      ? feed.photos[((n % feed.photos.length) + feed.photos.length) % feed.photos.length]!
      : null;

  return (
    <div className="fixed inset-0 z-[100]">
      <DisplayShell
        feed={feed}
        staleMinutes={staleMinutes}
        slideKey={`${slide}-${activeId ?? "none"}`}
        cadenceMs={cadenceMs}
        photoSide={
          // The Find us slide brings its own picture: the map.
          activeId === "findus" ? (
            <DisplayMap />
          ) : (
            <DisplayPhotoSide
              photo={photoAt(slide)}
              previous={slide > 0 ? photoAt(slide - 1) : null}
              overrideSrc={activeId === "promos" ? promo?.imageUrl : null}
              motion={feed.config.motion}
            />
          )
        }
      >
        {activeId === "today" ? <PanelToday feed={feed} /> : null}
        {activeId === "machines" ? (
          <PanelMachines machines={feed.machines} turn={cycle} />
        ) : null}
        {activeId === "upcoming" ? (
          <PanelUpcoming items={feed.upcoming} turn={cycle} />
        ) : null}
        {activeId === "certs" ? (
          <PanelCerts
            checkoffs={feed.checkoffs}
            onlineCerts={feed.onlineCerts}
          />
        ) : null}
        {activeId === "bounties" ? (
          <PanelBounties bounties={feed.bounties ?? []} turn={cycle} />
        ) : null}
        {activeId === "promos" && promo ? (
          <PanelPromos slides={[promo]} />
        ) : null}
        {activeId === "membership" ? (
          <PanelMembership membership={feed.membership} turn={cycle} />
        ) : null}
        {activeId === "findus" ? <PanelFindUs /> : null}
        {activeId === "spotlight" ? (
          <PanelSpotlight events={feed.spotlight ?? []} turn={cycle} />
        ) : null}
        {activeId === "community" ? (
          <PanelCommunity events={feed.community ?? []} turn={cycle} />
        ) : null}
        {rotation.length === 0 ? (
          <p className="text-[1.8vw] text-display-muted">
            Nothing scheduled to show right now.
          </p>
        ) : null}
      </DisplayShell>
    </div>
  );
}
