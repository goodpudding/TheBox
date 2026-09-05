"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/providers";
import { PageShell } from "@/components/page-shell";

export default function HomePage() {
  const { provider, currentUser, revision } = useData();
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      if (!currentUser) {
        router.replace("/join");
        return;
      }
      const state = await provider.getOnboardingState(currentUser.id);
      if (!state.complete && state.nextStep) {
        router.replace(`/onboarding/${state.nextStep}`);
        return;
      }
      router.replace("/dashboard");
    })();
  }, [currentUser, provider, revision, router]);

  return (
    <PageShell>
      <p className="text-secondary">Loading…</p>
    </PageShell>
  );
}
