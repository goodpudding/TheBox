"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/providers";
import { DisplayShell } from "@/components/display/display-shell";
import { PanelToday } from "@/components/display/panel-today";
import { PanelMachines } from "@/components/display/panel-machines";
import { PanelUpcoming } from "@/components/display/panel-upcoming";
import { PanelCerts } from "@/components/display/panel-certs";
import { PanelPromos } from "@/components/display/panel-promos";
import { PanelMembership } from "@/components/display/panel-membership";
import type { DisplayFeed, DisplayPanelId } from "@/lib/data";

const POLL_MS = 60_000;
const NIGHTLY_RELOAD_HOUR = 4;

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
  const { provider, revision } = useData();

  const [feed, setFeed] = useState<DisplayFeed | null>(null);
  const [denied, setDenied] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [staleMinutes, setStaleMinutes] = useState<number | null>(null);
  const [panelIndex, setPanelIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [promoIndex, setPromoIndex] = useState(0);
  const [nowTick, setNowTick] = useState(0);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/display/feed?token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        setDenied(true);
        return;
      }
      if (!res.ok) throw new Error(`Feed ${res.status}`);
      const apiFeed = (await res.json()) as DisplayFeed;
      try {
        const liveMachines = await provider.getMachineStatus();
        apiFeed.machines = liveMachines;
        const live = await provider.getDisplayFeed();
        apiFeed.todayReservations = live.todayReservations;
        apiFeed.todaySessions = live.todaySessions;
      } catch {
        /* keep API feed */
      }
      setFeed(apiFeed);
      setFetchedAt(Date.now());
      setStaleMinutes(null);
      setDenied(false);
    } catch {
      setFetchedAt((prev) => {
        if (prev != null) {
          setStaleMinutes(
            Math.max(1, Math.round((Date.now() - prev) / 60_000)),
          );
        }
        return prev;
      });
    }
  }, [token, provider]);

  useEffect(() => {
    if (!token) {
      setDenied(true);
      return;
    }
    void loadFeed();
    const poll = setInterval(() => void loadFeed(), POLL_MS);
    return () => clearInterval(poll);
  }, [token, loadFeed, revision]);

  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (new Date().getHours() === NIGHTLY_RELOAD_HOUR) {
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
