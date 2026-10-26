"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useData } from "@/components/providers";
import { isLiveDataMode } from "@/lib/data/mode";

export function StaffGate({ children }: { children: ReactNode }) {
  const { currentUser, sessionResolved } = useData();
  const live = isLiveDataMode();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!live || !sessionResolved || currentUser) return;
    router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }, [live, sessionResolved, currentUser, pathname, router]);

  if (!sessionResolved || (live && !currentUser)) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (!currentUser) {
    return (
      <PageShell>
        <p className="eyebrow">Staff</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-brown">
          Staff sign-in required
        </h1>
        <p className="mt-4 max-w-lg text-secondary leading-relaxed">
          Sign in with a staff account to open this area.
        </p>
        <Button asChild className="mt-8">
          <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>
            Sign in
          </Link>
        </Button>
      </PageShell>
    );
  }

  if (currentUser.role !== "staff" && currentUser.role !== "admin") {
    return (
      <PageShell>
        <p className="eyebrow">Staff</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-brown">
          Staff only
        </h1>
        <p className="mt-4 max-w-lg text-secondary leading-relaxed">
          Signed in as {currentUser.displayName} ({currentUser.role}). This
          area is for staff.
        </p>
        <Button asChild className="mt-8" variant="secondary">
          <Link href="/dashboard">Member dashboard</Link>
        </Button>
      </PageShell>
    );
  }

  return <>{children}</>;
}
