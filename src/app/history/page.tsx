"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type { ContentPage } from "@/lib/data";

export default function HistoryPage() {
  const { provider, revision } = useData();
  const [page, setPage] = useState<ContentPage | null>(null);

  useEffect(() => {
    void provider.getContentBySlug("history").then(setPage);
  }, [provider, revision]);

  return (
    <PageShell>
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <PageHero
          eyebrow="About"
          title="How The Box got here"
          description="A public shop in downtown Burien, run by Discover Burien — from a Farmers Market problem to memberships, certs, and classes in this portal."
        />
        <div className="relative aspect-[16/10] overflow-hidden bg-brown/10 lg:mb-1">
          <Image
            src="/images/the-box-exterior.jpg"
            alt="Looking toward The Box from the surrounding parking area"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-[center_30%]"
            priority
          />
        </div>
      </div>

      {page ? (
        <div
          className="prose-cms mt-10 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      ) : null}

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/staff">Staff &amp; instructors</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/join">Join the shop</Link>
        </Button>
      </div>
    </PageShell>
  );
}
