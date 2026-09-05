"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useData } from "@/components/providers";
import type { OnboardingState } from "@/lib/data";

const ONBOARDING_PREFIX = "/onboarding";

function stepPath(step: NonNullable<OnboardingState["nextStep"]>) {
  return `${ONBOARDING_PREFIX}/${step}`;
}

export function MemberGate({
  children,
  requireOnboardingComplete = true,
}: {
  children: ReactNode;
  /** When false, allow incomplete onboarding (for onboarding pages themselves). */
  requireOnboardingComplete?: boolean;
}) {
  const { provider, currentUser, revision } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentUser) {
        if (!cancelled) {
          setOnboarding(null);
          setReady(true);
        }
        return;
      }
      const state = await provider.getOnboardingState(currentUser.id);
      if (cancelled) return;
      setOnboarding(state);
      setReady(true);

      if (
        requireOnboardingComplete &&
        !state.complete &&
        state.nextStep &&
        !pathname.startsWith(ONBOARDING_PREFIX)
      ) {
        router.replace(stepPath(state.nextStep));
      }

      if (
        !requireOnboardingComplete &&
        state.nextStep &&
        pathname.startsWith(ONBOARDING_PREFIX)
      ) {
        const expected = stepPath(state.nextStep);
        // Allow staying on current step or earlier completed steps only via nextStep
        if (pathname !== expected && state.complete === false) {
          // If they somehow land on a later step early, send them back
          const order = ["profile", "waiver", "expectations"] as const;
          const here = order.findIndex((s) => pathname.endsWith(s));
          const need = order.findIndex((s) => s === state.nextStep);
          if (here > need) router.replace(expected);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    provider,
    revision,
    requireOnboardingComplete,
    pathname,
    router,
  ]);

  if (!ready) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (!currentUser) {
    return (
      <PageShell>
        <p className="eyebrow">Members</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-brown">
          Sign in to continue
        </h1>
        <p className="mt-4 max-w-lg text-secondary leading-relaxed">
          In this mock phase, pick a member from the{" "}
          <strong className="text-charcoal">Dev · Switch user</strong> bar at
          the bottom of the screen. Try Avery Brooks for a fresh onboarding
          walkthrough, or Jamie Ortiz to re-sign an outdated waiver.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/join">Membership options</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (
    requireOnboardingComplete &&
    onboarding &&
    !onboarding.complete &&
    onboarding.nextStep
  ) {
    return (
      <PageShell>
        <p className="text-secondary">Continuing onboarding…</p>
      </PageShell>
    );
  }

  return <>{children}</>;
}
