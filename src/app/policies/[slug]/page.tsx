"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import type { ContentPage } from "@/lib/data";

export default function PolicyDetailPage() {
  const params = useParams<{ slug: string }>();
  const { provider, revision } = useData();
  const [page, setPage] = useState<ContentPage | null | undefined>(undefined);

  useEffect(() => {
    void provider.getContentBySlug(params.slug).then((p) => {
      if (!p || p.category !== "policy") setPage(null);
      else setPage(p);
    });
  }, [provider, revision, params.slug]);

  if (page === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (page === null) {
    return (
      <PageShell>
        <h1 className="font-display text-2xl font-semibold text-brown">
          Policy not found
        </h1>
        <Link
          href="/policies"
          className="mt-4 inline-block font-display text-sm text-primary-text hover:underline"
        >
          ← All policies
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link
        href="/policies"
        className="font-display text-sm font-medium text-primary-text hover:underline"
      >
        ← All policies
      </Link>
      <p className="eyebrow mt-6">Policy</p>
      <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-brown sm:text-4xl">
        {page.title}
      </h1>
      <p className="mt-2 font-display text-xs uppercase tracking-wider text-secondary">
        Version {page.version}
      </p>
      <div
        className="prose-cms mt-8 max-w-3xl"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </PageShell>
  );
}
