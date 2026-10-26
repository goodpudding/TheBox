"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import type { ContentPage } from "@/lib/data";

export default function PoliciesIndexPage() {
  const { provider, revision } = useData();
  const [policies, setPolicies] = useState<ContentPage[]>([]);

  useEffect(() => {
    void provider.listPolicies().then(setPolicies);
  }, [provider, revision]);

  return (
    <PageShell>
      <PageHero
        eyebrow="House policies"
        title="How we share the shop"
        description="Staff keep these pages up to date from the shared Google Drive folder."
      />

      <ul className="mt-12 divide-y divide-border border-y border-border">
        {policies.map((policy) => (
          <li key={policy.id}>
            <Link
              href={`/policies/${policy.slug}`}
              className="group flex items-baseline justify-between gap-4 py-5"
            >
              <span className="font-display text-lg font-semibold text-brown group-hover:text-primary-text transition-colors">
                {policy.title}
              </span>
              <span className="font-display text-sm text-secondary shrink-0">
                Read →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
