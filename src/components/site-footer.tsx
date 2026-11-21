"use client";

import Image from "next/image";
import Link from "next/link";
import { SocialLinks } from "@/components/project-highlights";
import { useSiteInfo } from "@/components/use-site-info";

export function SiteFooter() {
  const site = useSiteInfo();
  return (
    <footer className="mt-auto bg-footer text-white/90">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="rounded-md bg-white px-3 py-2">
            <Image
              src="/brand/discover-burien-logo.png"
              alt="Discover Burien"
              width={120}
              height={80}
              className="h-12 w-auto object-contain"
            />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">
              {site.orgName}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {site.addressLine}
            </p>
          </div>
        </div>
        <p className="mt-5 max-w-xl text-sm text-white/65 font-serif leading-relaxed">
          {site.blurb}
        </p>
        <SocialLinks tone="dark" className="mt-5 text-white/90" />
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-display text-sm">
          <Link href="/events" className="hover:text-primary transition-colors">
            Events
          </Link>
          <Link href="/made" className="hover:text-primary transition-colors">
            Made here
          </Link>
          <Link href="/bounties" className="hover:text-primary transition-colors">
            Bounties
          </Link>
          <Link
            href="/history"
            className="hover:text-primary transition-colors"
          >
            History
          </Link>
          <Link href="/staff" className="hover:text-primary transition-colors">
            Staff
          </Link>
          <Link
            href="/wishlist"
            className="hover:text-primary transition-colors"
          >
            Wishlist
          </Link>
          <Link href="/join" className="hover:text-primary transition-colors">
            Join
          </Link>
          <Link
            href="/support"
            className="hover:text-primary transition-colors"
          >
            Support
          </Link>
          <Link
            href="/policies"
            className="hover:text-primary transition-colors"
          >
            Policies
          </Link>
          <Link
            href="/volunteer"
            className="hover:text-primary transition-colors"
          >
            Volunteer
          </Link>
          <a
            href="https://discoverburien.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            discoverburien.org
          </a>
        </div>
      </div>
    </footer>
  );
}
