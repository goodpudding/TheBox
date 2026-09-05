import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
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
              The Box · Discover Burien Makerspace
            </p>
            <p className="mt-1 text-sm text-white/55">
              611 SW 152nd St (lower level) · access from SW 153rd · Burien, WA
            </p>
          </div>
        </div>
        <p className="mt-5 max-w-xl text-sm text-white/65 font-serif leading-relaxed">
          A community makerspace in Burien, WA, run by Discover Burien.
          Membership, classes, and machine access live here — the rest of our
          public story lives on discoverburien.org.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-display text-sm">
          <Link href="/events" className="hover:text-primary transition-colors">
            Events
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
