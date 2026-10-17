"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canMarkWishlistPurchased,
  formatWishlistPrice,
  groupNeededByZone,
  WISHLIST_PRICE_BANDS,
  type WishlistPriceBandId,
} from "@/lib/data/wishlist";
import type {
  OrgSettings,
  WishlistCatalog,
  WishlistItemView,
} from "@/lib/data";

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "rounded-full bg-brown px-3 py-1.5 font-display text-sm font-medium text-white"
          : "rounded-full border border-border bg-surface px-3 py-1.5 font-display text-sm font-medium text-secondary hover:border-brown/30 hover:text-brown"
      }
    >
      {children}
    </button>
  );
}

export default function WishlistPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [catalog, setCatalog] = useState<WishlistCatalog | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [zoneId, setZoneId] = useState<string>("all");
  const [priceBand, setPriceBand] = useState<WishlistPriceBandId>("all");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isStaff = canMarkWishlistPurchased(currentUser);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [next, org] = await Promise.all([
        provider.getWishlistCatalog(),
        provider.getSettings(),
      ]);
      if (cancelled) return;
      setCatalog(next);
      setSettings(org);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const needed = useMemo(
    () => (catalog ? catalog.items.filter((i) => i.status === "needed") : []),
    [catalog],
  );

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return groupNeededByZone(catalog.zones, needed, { zoneId, priceBand });
  }, [catalog, needed, zoneId, priceBand]);

  const shownCount = grouped.reduce((n, g) => n + g.items.length, 0);

  async function onReport(e: FormEvent<HTMLFormElement>, item: WishlistItemView) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      await provider.reportWishlistPurchase({
        itemId: item.id,
        name:
          String(form.get("name") ?? "") || currentUser?.displayName || "",
        email: String(form.get("email") ?? "") || currentUser?.email || "",
        note: String(form.get("note") ?? "") || null,
        userId: currentUser?.id ?? null,
      });
      bump();
      setReportingId(null);
      setMessage(
        `Thanks — “${item.name}” stays on the list until staff confirm the purchase.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setPending(false);
    }
  }

  async function onMarkPurchased(item: WishlistItemView) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminMarkWishlistPurchased(item.id, currentUser.id);
      bump();
      setMessage(`Marked “${item.name}” purchased. It’s off the public ask list.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setPending(false);
    }
  }

  const contact = settings?.contactEmail ?? "thebox@discoverburien.org";
  const donateUrl = settings?.donationUrl ?? settings?.paymentUrl ?? null;

  return (
    <PageShell>
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <PageHero
          eyebrow="Support · Wishlist"
          title="Help build the shop, item by item"
          description="Everything The Box still needs, with a link to the exact product we picked. Give a whole station, or grab a $15 spool of filament. Every piece ends up in members’ hands at the bench."
        />
        <div className="relative aspect-[16/10] overflow-hidden bg-brown/10 lg:mb-1">
          <Image
            src="/images/the-box-doors.jpg"
            alt="The Box entrance — orange Maker Space doors"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-center"
            priority
          />
        </div>
      </div>

      {catalog ? (
        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-display text-sm text-secondary">
          <span>
            <span className="font-semibold text-brown">
              {catalog.stats.neededCount}
            </span>{" "}
            items still needed
          </span>
          <span>
            <span className="font-semibold text-brown">
              {formatWishlistPrice(catalog.stats.coreCents)}
            </span>{" "}
            core build
          </span>
          <span>
            <span className="font-semibold text-brown">
              {formatWishlistPrice(catalog.stats.totalCents)}
            </span>{" "}
            with stretch goals
          </span>
          <span>
            <span className="font-semibold text-brown">
              {catalog.stats.under100Count}
            </span>{" "}
            gifts under $100
          </span>
          {catalog.stats.receivedCount > 0 ? (
            <span>
              <span className="font-semibold text-brown">
                {catalog.stats.receivedCount}
              </span>{" "}
              received so far
            </span>
          ) : null}
        </p>
      ) : (
        <p className="mt-8 text-secondary">Loading the list…</p>
      )}

      <section className="mt-12" aria-labelledby="give-h">
        <p className="eyebrow">How to give an item</p>
        <h2 id="give-h" className="sr-only">
          How to give an item
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-primary-text">
              Step 1
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-brown">
              Pick something
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Filter by area or by price. Each link goes to the exact product we
              picked, so everything in the space matches. Please buy that model;
              the same model from another store is fine. For lumber and paint, a
              Home Depot gift card works too.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-primary-text">
              Step 2
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-brown">
              Tell us first
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              So two people don’t buy the same saw. Email{" "}
              <a
                className="text-primary-text underline"
                href={`mailto:${contact}`}
              >
                {contact}
              </a>
              , talk to staff in the shop, or message us on the makerspace
              Discord. You can also tap “I bought this” below — that stays
              pending until staff confirm, so the item stays on the list.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-primary-text">
              Step 3
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-brown">
              Ship it or drop it off
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              We’ll give you the shipping address when you check in. Staff mark
              it purchased once it lands, then send a gift receipt for your
              taxes.
            </p>
          </div>
        </div>
        {donateUrl ? (
          <p className="mt-4 text-sm text-secondary">
            Rather give cash toward a station?{" "}
            <a
              className="text-primary-text underline"
              href={donateUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate here
            </a>
            . Big-ticket items (table saw, fume extractor, UV printer) also work
            as named sponsorships — ask about putting your business’s name on a
            station.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/support">Other ways to give</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/volunteer">Get involved</Link>
          </Button>
        </div>
      </section>

      {error ? (
        <p className="mt-8 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-8 text-sm text-primary-text">{message}</p>
      ) : null}

      {catalog ? (
        <div className="mt-12 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Area</span>
            <FilterChip
              pressed={zoneId === "all"}
              onClick={() => setZoneId("all")}
            >
              All areas
            </FilterChip>
            {catalog.zones.map((z) => (
              <FilterChip
                key={z.id}
                pressed={zoneId === z.id}
                onClick={() => setZoneId(z.id)}
              >
                {z.name}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Price</span>
            {WISHLIST_PRICE_BANDS.map((band) => (
              <FilterChip
                key={band.id}
                pressed={priceBand === band.id}
                onClick={() => setPriceBand(band.id)}
              >
                {band.label}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {catalog && shownCount === 0 ? (
        <p className="mt-10 text-secondary">
          Nothing in that range for this area. Try another price or area.
        </p>
      ) : null}

      <div className="mt-10 space-y-14">
        {grouped.map(({ zone, items, toGoCents }) => (
          <section key={zone.id}>
            <p className="eyebrow">Shop area</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-brown">
                {zone.name}
              </h2>
              <p className="font-display text-sm text-secondary">
                {formatWishlistPrice(toGoCents)} to go
              </p>
            </div>
            <p className="mt-2 max-w-3xl text-secondary leading-relaxed">
              {zone.why}
            </p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {items.map((item) => (
                <WishlistRow
                  key={item.id}
                  item={item}
                  isStaff={isStaff}
                  contactEmail={contact}
                  currentUser={currentUser}
                  reporting={reportingId === item.id}
                  pending={pending}
                  onToggleReport={() =>
                    setReportingId((id) => (id === item.id ? null : item.id))
                  }
                  onReport={(e) => void onReport(e, item)}
                  onMarkPurchased={() => void onMarkPurchased(item)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {catalog && catalog.recentlyFunded.length > 0 ? (
        <section className="mt-16 max-w-3xl">
          <p className="eyebrow">Recently funded</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-brown">
            Thank you
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Confirmed purchases from the last few months. They no longer show as
            needed.
          </p>
          <ul className="mt-6 space-y-3 text-secondary">
            {catalog.recentlyFunded.map((item) => (
              <li key={item.id}>
                <span className="font-display font-medium text-brown">
                  {item.name}
                </span>
                {item.model ? (
                  <span className="text-sm"> · {item.model}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-16 max-w-3xl text-sm leading-relaxed text-secondary">
        Prices are US retail as checked September–October 2026, before sales
        tax. They move with sales, so the store page is the final word. Prices
        marked “about” depend on the local store (lumber, pegboard) or haven’t
        been confirmed yet.
      </p>
    </PageShell>
  );
}

function WishlistRow({
  item,
  isStaff,
  contactEmail,
  currentUser,
  reporting,
  pending,
  onToggleReport,
  onReport,
  onMarkPurchased,
}: {
  item: WishlistItemView;
  isStaff: boolean;
  contactEmail: string;
  currentUser: { displayName: string; email: string } | null;
  reporting: boolean;
  pending: boolean;
  onToggleReport: () => void;
  onReport: (e: FormEvent<HTMLFormElement>) => void;
  onMarkPurchased: () => void;
}) {
  const unit = item.estimated ? "about, each" : "each";
  const line = item.qty > 1 ? item.priceCents * item.qty : null;

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h3 className="font-display text-lg font-semibold text-brown">
            {item.name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="font-display text-xs text-secondary">
              {item.model}
            </span>
            {item.qty > 1 ? (
              <span className="font-display text-xs text-secondary">
                Need {item.qty}
              </span>
            ) : null}
            {item.tier === "stretch" ? (
              <StatusPill tone="warn">Stretch goal</StatusPill>
            ) : null}
            {item.pendingReportCount > 0 ? (
              <StatusPill tone="info">
                Purchase reported — staff confirming
              </StatusPill>
            ) : null}
          </div>
          {item.note ? (
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              {item.note}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-semibold text-brown">
            {formatWishlistPrice(item.priceCents, item.estimated)}
          </p>
          <p className="mt-0.5 text-xs text-secondary">
            {unit}
            {line != null ? ` · ${formatWishlistPrice(line)} for all` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.url ? (
          <Button asChild size="sm">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Buy this one
            </a>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a href={`mailto:${contactEmail}`}>Talk to us</a>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onToggleReport}
        >
          I bought this
        </Button>
        {isStaff ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={onMarkPurchased}
          >
            Mark purchased
          </Button>
        ) : null}
      </div>
      {reporting ? (
        <form
          onSubmit={onReport}
          className="mt-5 max-w-xl space-y-3 rounded-2xl border border-border bg-surface/60 p-5"
        >
          <p className="text-sm text-secondary">
            This does not take the item off the list. Staff confirm it once the
            box is here (or the receipt checks out).
          </p>
          {!currentUser ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={`wl-name-${item.id}`}>Your name</Label>
                <Input id={`wl-name-${item.id}`} name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`wl-email-${item.id}`}>Email</Label>
                <Input
                  id={`wl-email-${item.id}`}
                  name="email"
                  type="email"
                  required
                />
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`wl-note-${item.id}`}>What you ordered (optional)</Label>
            <Textarea
              id={`wl-note-${item.id}`}
              name="note"
              rows={3}
              maxLength={500}
              placeholder="Store, order number, when it ships…"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Tell staff"}
          </Button>
        </form>
      ) : null}
    </li>
  );
}
