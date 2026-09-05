"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import type { ContentPage, OrgSettings, ScholarshipFundSummary } from "@/lib/data";

export default function SupportPage() {
  const { provider, revision } = useData();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [intro, setIntro] = useState<ContentPage | null>(null);
  const [wishlist, setWishlist] = useState<ContentPage | null>(null);
  const [sponsors, setSponsors] = useState<ContentPage | null>(null);
  const [fund, setFund] = useState<ScholarshipFundSummary | null>(null);

  useEffect(() => {
    void (async () => {
      setSettings(await provider.getSettings());
      setIntro(await provider.getContentBySlug("support"));
      setWishlist(await provider.getContentBySlug("wishlist"));
      setSponsors(await provider.getContentBySlug("business-sponsors"));
      setFund(await provider.getScholarshipFundSummary());
    })();
  }, [provider, revision]);

  return (
    <PageShell>
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <PageHero
          eyebrow="Support"
          title="Fund the front door"
          description="Give to the general fund, grow scholarship seats, or pick something concrete off the wishlist. Business sponsorships plug into Discover Burien’s existing member roster."
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

      {fund ? (
        <p className="mt-8 max-w-2xl rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 font-display text-base text-brown">
          Patrons are currently funding{" "}
          <span className="font-semibold">{fund.seatsAwarded}</span> scholarship
          seat{fund.seatsAwarded === 1 ? "" : "s"}. Seat math is mechanical:
          fund balance ÷ Maker dues (
          {fund.makerMonthlyCents / 100}/mo).
        </p>
      ) : null}

      {intro ? (
        <div
          className="prose-cms mt-8 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: intro.html }}
        />
      ) : null}

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg">
          <a
            href={settings?.donationUrl ?? settings?.paymentUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            General fund
          </a>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <a
            href={settings?.scholarshipDonationUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Scholarship fund
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/join">Browse memberships</Link>
        </Button>
      </div>
      <p className="mt-4 max-w-xl text-sm text-secondary">
        Donations open on Zeffy (or your configured nonprofit checkout). Tax
        deductibility depends on Discover Burien’s legal status — staff will
        note that on the live form before public launch.
      </p>

      <section className="mt-16 max-w-3xl">
        <p className="eyebrow">Wishlist</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          Specific asks
        </h2>
        {wishlist ? (
          <div
            className="prose-cms mt-4"
            dangerouslySetInnerHTML={{ __html: wishlist.html }}
          />
        ) : null}
      </section>

      <section className="mt-16 max-w-3xl">
        <p className="eyebrow">Businesses</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          Sponsorship levels
        </h2>
        {sponsors ? (
          <div
            className="prose-cms mt-4"
            dangerouslySetInnerHTML={{ __html: sponsors.html }}
          />
        ) : null}
        <p className="mt-4 text-secondary">
          Interested? Email{" "}
          <a
            className="text-primary-text underline"
            href={`mailto:${settings?.contactEmail ?? "thebox@discoverburien.org"}`}
          >
            {settings?.contactEmail ?? "thebox@discoverburien.org"}
          </a>
          .
        </p>
      </section>
    </PageShell>
  );
}
