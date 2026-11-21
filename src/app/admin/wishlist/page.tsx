"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { formatWishlistPrice } from "@/lib/data/wishlist";
import { formatDateTime } from "@/lib/format";
import type {
  WishlistCatalog,
  WishlistItemView,
  WishlistPurchaseReportView,
} from "@/lib/data";

export default function AdminWishlistPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [catalog, setCatalog] = useState<WishlistCatalog | null>(null);
  const [reports, setReports] = useState<WishlistPurchaseReportView[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setCatalog(await provider.getWishlistCatalog());
      setReports(await provider.adminListWishlistPurchaseReports());
    })();
  }, [provider, revision]);

  const pendingReports = useMemo(
    () => reports.filter((r) => r.status === "pending"),
    [reports],
  );
  const needed = useMemo(
    () =>
      (catalog?.items ?? [])
        .filter((i) => i.status === "needed")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  );
  const fulfilled = useMemo(
    () =>
      (catalog?.items ?? [])
        .filter((i) => i.status === "fulfilled")
        .sort((a, b) => {
          const aAt = a.fulfilledAt ? new Date(a.fulfilledAt).getTime() : 0;
          const bAt = b.fulfilledAt ? new Date(b.fulfilledAt).getTime() : 0;
          return bAt - aAt;
        }),
    [catalog],
  );

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!currentUser) return;
    setPendingId(label);
    setError(null);
    setMessage(null);
    try {
      await fn();
      bump();
      setMessage("Updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AdminShell
      title="Wishlist"
      description="Confirm purchases so they leave the public ask list. Guest “I bought this” reports stay pending until you say they landed."
    >
      <p className="mb-8 text-sm text-secondary">
        Public page:{" "}
        <Link href="/wishlist" className="text-primary-text underline">
          /wishlist
        </Link>
        . This app does not take card charges. External store links stay on the
        item until staff (or a matching Zeffy payment) mark it purchased.
      </p>

      {error ? (
        <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-brown">
          {message}
        </p>
      ) : null}

      <section>
        <p className="eyebrow">Inbox</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-brown">
          Purchase reports
        </h2>
        {pendingReports.length === 0 ? (
          <p className="mt-4 text-secondary">No pending reports.</p>
        ) : (
          <ul className="mt-6 space-y-6">
            {pendingReports.map((row) => (
              <li
                key={row.id}
                className="border-b border-border pb-6 last:border-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-brown">
                      {row.itemName}
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      {row.itemModel} · {row.name} · {row.email}
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      Reported {formatDateTime(row.createdAt)}
                    </p>
                    {row.note ? (
                      <p className="mt-2 text-sm text-charcoal">{row.note}</p>
                    ) : null}
                  </div>
                  <StatusPill tone="warn">Pending</StatusPill>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() =>
                      void run(`confirm-${row.id}`, () =>
                        provider.adminConfirmWishlistPurchase(
                          row.id,
                          currentUser!.id,
                        ),
                      )
                    }
                  >
                    Confirm — mark purchased
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId !== null}
                    onClick={() =>
                      void run(`dismiss-${row.id}`, () =>
                        provider.adminDismissWishlistPurchase(
                          row.id,
                          currentUser!.id,
                        ),
                      )
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <p className="eyebrow">Still needed</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-brown">
          Mark purchased
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          Use this when someone bought it in the shop or emailed you, without
          filing a report. Confirmed items leave the public list.
        </p>
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {needed.map((item) => (
            <NeededRow
              key={item.id}
              item={item}
              disabled={pendingId !== null}
              onMark={() =>
                void run(`mark-${item.id}`, () =>
                  provider.adminMarkWishlistPurchased(item.id, currentUser!.id),
                )
              }
            />
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <p className="eyebrow">History</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-brown">
          Fulfilled
        </h2>
        {fulfilled.length === 0 ? (
          <p className="mt-4 text-secondary">Nothing marked purchased yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {fulfilled.map((item) => (
              <li key={item.id} className="text-sm text-secondary">
                <span className="font-display font-medium text-brown">
                  {item.name}
                </span>
                {item.fulfilledAt
                  ? ` · ${formatDateTime(item.fulfilledAt)}`
                  : ""}
                {item.fulfilledBy ? ` · ${item.fulfilledBy}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

function NeededRow({
  item,
  disabled,
  onMark,
}: {
  item: WishlistItemView;
  disabled: boolean;
  onMark: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="font-display font-semibold text-brown">{item.name}</p>
        <p className="mt-1 text-sm text-secondary">
          {item.zoneName} · {item.model} ·{" "}
          {formatWishlistPrice(item.priceCents, item.estimated)}
          {item.pendingReportCount > 0
            ? ` · ${item.pendingReportCount} report${item.pendingReportCount === 1 ? "" : "s"} pending`
            : ""}
        </p>
      </div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onMark}>
        Mark purchased
      </Button>
    </li>
  );
}
