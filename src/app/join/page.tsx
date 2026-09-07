"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MakerspaceBanner } from "@/components/brand-logo";
import { PageShell } from "@/components/page-shell";
import { UpcomingEvents } from "@/components/upcoming-events";
import { useData } from "@/components/providers";
import {
  formatBillingInterval,
  formatMoney,
} from "@/lib/utils";
import type {
  ContentPage,
  MembershipProduct,
  OrgSettings,
  ScholarshipFundSummary,
} from "@/lib/data";

export default function JoinPage() {
  const { provider, revision } = useData();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [hours, setHours] = useState<ContentPage | null>(null);
  const [products, setProducts] = useState<MembershipProduct[]>([]);
  const [fund, setFund] = useState<ScholarshipFundSummary | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await provider.getSettings();
      setSettings(s);
      setHours(await provider.getContentBySlug(s.hoursContentSlug));
      setProducts(await provider.listMembershipProducts());
      setFund(await provider.getScholarshipFundSummary());
    })();
  }, [provider, revision]);

  const current = products.filter((p) => p.phase < 3);
  const coming = products.filter((p) => p.phase === 3);

  return (
    <div>
      <section className="relative min-h-[min(78vh,720px)] overflow-hidden bg-brown">
        <Image
          src="/images/the-box-doors.jpg"
          alt="Orange Maker Space doors at The Box entrance"
          fill
          priority
          sizes="100vw"
          className="anim-hero-zoom object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#f5f5f5] via-[#f5f5f5]/75 to-transparent"
        />
        <div className="relative mx-auto flex min-h-[min(78vh,720px)] max-w-6xl flex-col justify-end px-4 pb-12 pt-28 sm:px-6 sm:pb-16">
          <div className="anim-rise max-w-xl">
            <MakerspaceBanner priority className="mb-6 drop-shadow-sm" />
            <h1 className="font-display text-4xl font-semibold tracking-tight text-brown sm:text-5xl">
              Join The Box
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-secondary">
              Burien&apos;s community makerspace — memberships, day passes, and
              ways to support without stepping onto the shop floor.
            </p>
          </div>
          <div className="anim-rise-delay mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a
                href={settings?.paymentUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join
              </a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a
                href="https://discoverburien.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Take a class
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/support">Support</Link>
            </Button>
          </div>
        </div>
      </section>

      <PageShell className="pt-10 sm:pt-12">
        <section className="mb-14">
          <p className="eyebrow">Coming up</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
            Classes &amp; open studio
          </h2>
          <p className="mt-3 max-w-2xl text-secondary leading-relaxed">
            Drop into a workshop before you join, or start with free shop
            orientation. Seats are limited.
          </p>
          <div className="mt-8">
            <UpcomingEvents limit={5} />
          </div>
        </section>

        <section className="mb-14">
          <p className="eyebrow">Made at The Box</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
            See what members are building
          </h2>
          <p className="mt-3 max-w-2xl text-secondary leading-relaxed">
            Laser cuts, prints, textiles, and woodshop firsts — a living gallery
            of work from the space.
          </p>
          <div className="mt-6">
            <Button asChild variant="secondary">
              <Link href="/made">Browse Made here</Link>
            </Button>
          </div>
        </section>

        {fund ? (
          <p className="anim-rise-delay-2 max-w-2xl border-l-4 border-primary bg-primary/10 px-5 py-4 font-display text-base text-brown">
            Patrons are currently funding{" "}
            <span className="font-semibold">{fund.seatsAwarded}</span> scholarship
            seat{fund.seatsAwarded === 1 ? "" : "s"}
            {fund.seatsAvailable > 0
              ? ` · ${fund.seatsAvailable} more seat${fund.seatsAvailable === 1 ? "" : "s"} available from the fund`
              : ""}
            .
          </p>
        ) : null}

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {current.map((product) => (
            <TierCard
              key={product.id}
              product={product}
              fund={fund}
              communityNote={
                product.tier === "community" && fund
                  ? `${fund.communitySeatsUsed} of ${fund.communitySeatCap} Community seats in use`
                  : undefined
              }
            />
          ))}
        </div>

        {coming.length > 0 ? (
          <section className="mt-16">
            <p className="eyebrow">Coming in 2027</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
              After badge access ships
            </h2>
            <p className="mt-3 max-w-2xl text-secondary leading-relaxed">
              Maker Pro, Unlimited, and Team wait until the badge system can
              enforce priority booking and we have real usage data. Listed here
              so the ladder is complete — not joinable yet.
            </p>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {coming.map((product) => (
                <TierCard key={product.id} product={product} comingSoon />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-16 grid items-end gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Find us</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
              Orange doors off SW 153rd
            </h2>
            <p className="mt-4 max-w-xl text-secondary leading-relaxed">
              We&apos;re on the lower level at 611 SW 152nd St, Burien — access
              from SW 153rd between Ambaum and 6th Ave SW, behind Discover
              Burien. Look for the orange Maker Space doors.
            </p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden bg-brown/10">
            <Image
              src="/images/the-box-exterior.jpg"
              alt="Street view looking toward The Box from the parking area"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </section>

        <section className="mt-16 max-w-2xl">
          <p className="eyebrow">How joining works</p>
          <ul className="mt-4 space-y-3 text-secondary leading-relaxed">
            <li>
              Payments stay on our external checkout (Zeffy). This portal manages
              account, waiver, certifications, and shop access after staff
              activate you.
            </li>
            <li>
              Class tickets include a day pass good for 30 days; join in that
              window and your first month can start at the Community rate.
            </li>
            <li>
              Gift memberships and class + membership bundles roll out for the
              holiday season — ask staff or check Support.
            </li>
          </ul>
          <p className="mt-6 text-sm text-secondary">
            Prefer to help without joining?{" "}
            <Link href="/support" className="text-primary-text underline">
              Donate or sponsor
            </Link>
            . Want open hours for free membership?{" "}
            <Link href="/volunteer" className="text-primary-text underline">
              Become a Shop Steward
            </Link>
            .
          </p>
        </section>

        <section className="mt-16 max-w-2xl">
          <p className="eyebrow">Hours</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
            When we&apos;re open
          </h2>
          {hours ? (
            <div
              className="prose-cms mt-4"
              dangerouslySetInnerHTML={{ __html: hours.html }}
            />
          ) : (
            <p className="mt-4 text-secondary">Loading hours…</p>
          )}
        </section>
      </PageShell>
    </div>
  );
}

function TierCard({
  product,
  fund,
  communityNote,
  comingSoon,
}: {
  product: MembershipProduct;
  fund?: ScholarshipFundSummary | null;
  communityNote?: string;
  comingSoon?: boolean;
}) {
  const priceLabel =
    product.priceCents === 0
      ? product.tier === "scholarship"
        ? "$0"
        : "Free"
      : formatMoney(product.priceCents);

  return (
    <article
      className={
        product.highlight
          ? "rounded-[1.75rem] border-2 border-primary/40 bg-surface p-6 sm:p-8"
          : comingSoon
            ? "rounded-[1.75rem] border border-dashed border-border bg-surface/50 p-6 sm:p-8"
            : "rounded-[1.75rem] border border-border bg-surface/80 p-6 sm:p-8"
      }
    >
      <p className="eyebrow mb-3">
        {comingSoon
          ? "Phase 3"
          : product.highlight
            ? "Anchor"
            : product.isAddOn
              ? "Add-on"
              : product.shopAccess
                ? "Shop access"
                : "Supporter"}
      </p>
      <h2 className="font-display text-2xl font-semibold text-brown">
        {product.name}
      </h2>
      <p className="mt-2 font-display text-3xl font-semibold text-charcoal">
        {priceLabel}
        <span className="ml-1 text-base font-medium text-secondary">
          {formatBillingInterval(product.billingInterval)}
        </span>
      </p>
      {product.annualPriceCents ? (
        <p className="mt-1 font-display text-sm text-secondary">
          or {formatMoney(product.annualPriceCents)} / year
          {product.tier === "maker" ? " (two months free)" : ""}
        </p>
      ) : null}
      <p className="mt-3 text-secondary leading-relaxed">{product.summary}</p>
      {communityNote ? (
        <p className="mt-3 font-display text-xs uppercase tracking-wider text-primary-text">
          {communityNote}
        </p>
      ) : null}
      {product.tier === "patron" && fund ? (
        <p className="mt-3 font-display text-xs uppercase tracking-wider text-primary-text">
          ${fund.patronSurchargeCents / 100}/mo of dues → scholarship fund
        </p>
      ) : null}
      {comingSoon ? (
        <p className="mt-4 font-display text-sm font-semibold text-secondary">
          Coming soon — not available to join yet
        </p>
      ) : !product.joinable && product.tier === "scholarship" ? (
        <p className="mt-4 font-display text-sm text-secondary">
          Apply via staff / partner referral — not self-checkout.
        </p>
      ) : !product.joinable && product.tier === "shop_steward" ? (
        <p className="mt-4">
          <Link
            href="/volunteer"
            className="font-display text-sm font-semibold text-primary-text underline"
          >
            Apply on the Volunteer page →
          </Link>
        </p>
      ) : null}
    </article>
  );
}
