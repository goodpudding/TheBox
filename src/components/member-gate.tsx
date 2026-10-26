"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useData } from "@/components/providers";
import { isLiveDataMode } from "@/lib/data/mode";
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
  const { provider, currentUser, userError, revision, sessionResolved } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const live = isLiveDataMode();
  const [ready, setReady] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionResolved) return;
    let cancelled = false;
    void (async () => {
      if (!currentUser) {
        if (live && !userError) {
          const next = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
          router.replace(next);
        }
        if (!cancelled) {
          setOnboarding(null);
          setReady(true);
        }
        return;
      }
      try {
        const state = await provider.getOnboardingState(currentUser.id);
        if (cancelled) return;
        setOnboarding(state);
        setGateError(null);
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
      } catch (err) {
        if (cancelled) return;
        setGateError(
          err instanceof Error ? err.message : "Could not load your account",
        );
        setReady(true);
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
    sessionResolved,
    live,
    userError,
  ]);

  if (!sessionResolved || (live && !currentUser && !userError)) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (userError || gateError) {
    return (
      <PageShell>
        <p className="text-accent" role="alert">
          {userError ?? gateError}
        </p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </PageShell>
    );
  }

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
          Use the email on your membership. We’ll send a one-time sign-in link.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>
              Sign in
            </Link>
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
