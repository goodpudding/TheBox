"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { InventoryPhoto } from "@/components/inventory-photo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { canInventory, conditionLabel } from "@/lib/inventory";
import type { AreaSteward, InventoryItemView } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export default function InventoryReviewPage() {
  return (
    <MemberGate>
      <ReviewBody />
    </MemberGate>
  );
}

function ReviewBody() {
  const { provider, currentUser, revision, bump } = useData();
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [stewards, setStewards] = useState<AreaSteward[]>([]);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void Promise.all([
      provider.listInventoryItems(currentUser.id, {
        reviewStatus: "PENDING",
        includePending: true,
        includeRetired: true,
      }),
      provider.listAreaStewards(),
    ]).then(([list, rows]) => {
      if (cancelled) return;
      setItems(list.filter((i) => i.reviewStatus === "PENDING"));
      setStewards(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, currentUser, revision]);

  if (
    currentUser &&
    !canInventory(currentUser, "viewPending", { stewards })
  ) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Inventory"
          title="Review queue"
          description="Stewards see pending items for their areas. Staff see all."
        />
        <p className="mt-6 text-secondary">You don’t have review access.</p>
      </PageShell>
    );
  }

  async function approve(id: string) {
    if (!currentUser) return;
    setError(null);
    try {
      await provider.reviewInventoryItem(currentUser.id, id, "approve");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function reject(id: string) {
    if (!currentUser) return;
    setError(null);
    try {
      await provider.reviewInventoryItem(
        currentUser.id,
        id,
        "reject",
        reason.trim(),
      );
      setRejecting(null);
      setReason("");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Inventory"
        title="Review queue"
        description="Stewards see pending items for their areas. Staff see all."
      />
      <InventorySubnav />
      {error ? (
        <p className="mb-4 rounded-xl bg-accent/15 px-4 py-3 text-sm text-brown">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-secondary">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <InventoryPhoto
                  storageKey={
                    item.frontPhoto?.thumbKey ?? item.frontPhoto?.storageKey
                  }
                  alt=""
                  className="h-40 w-full sm:h-full"
                />
                <div className="p-4 sm:pr-5 sm:pt-4">
                  <p className="font-display text-xs font-semibold text-primary-text">
                    {item.assetTag}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-brown">
                    {item.name}
                  </h2>
                  <p className="mt-1 text-sm text-secondary">
                    {[item.manufacturer, item.model, item.areaName ?? "Area not sure"]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-sm text-secondary">
                    Submitted by {item.createdByName ?? "someone"} ·{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill>{conditionLabel(item.condition)}</StatusPill>
                    {item.serialNumber ? (
                      <StatusPill tone="info">S/N {item.serialNumber}</StatusPill>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void approve(item.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/inventory/${item.assetTag}`}>
                        Edit then approve
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRejecting(rejecting === item.id ? null : item.id)
                      }
                    >
                      Reject
                    </Button>
                  </div>
                  {rejecting === item.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason shown to the submitter"
                      />
                      <Button
                        size="sm"
                        onClick={() => void reject(item.id)}
                        disabled={!reason.trim()}
                      >
                        Confirm reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
