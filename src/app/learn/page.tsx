"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import type { LearningModuleView } from "@/lib/data";

export default function LearnIndexPage() {
  return (
    <MemberGate>
      <LearnIndexBody />
    </MemberGate>
  );
}

function LearnIndexBody() {
  const { provider, revision } = useData();
  const [modules, setModules] = useState<LearningModuleView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setModules(await provider.listModules());
      setLoading(false);
    })();
  }, [provider, revision]);

  return (
    <PageShell>
      <PageHero
        eyebrow="Learn"
        title="Self-study modules"
        description="Work through lessons, then take a knowledge quiz. Passing records knowledge_passed for the linked certification — hands-on checkoff with staff is still required unless the module is knowledge-only."
      />

      {loading ? (
        <p className="mt-10 text-secondary">Loading modules…</p>
      ) : (
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {modules.map((mod) => {
            const allLessonsDone =
              mod.lessonCount > 0 &&
              mod.completedLessonCount >= mod.lessonCount;
            return (
              <li key={mod.id} className="py-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-xl">
                    <h2 className="font-display text-xl font-semibold text-brown">
                      <Link
                        href={`/learn/${mod.slug}`}
                        className="hover:text-primary-text"
                      >
                        {mod.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-secondary leading-relaxed">
                      {mod.summary}
                    </p>
                    <p className="mt-2 text-sm text-secondary">
                      Linked cert: {mod.certification.name}
                      {mod.knowledgeOnly ? " · knowledge-only" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill
                      tone={
                        mod.knowledgePassed
                          ? "ok"
                          : allLessonsDone
                            ? "info"
                            : "muted"
                      }
                    >
                      {mod.knowledgePassed
                        ? "Knowledge passed"
                        : allLessonsDone
                          ? "Ready for quiz"
                          : `${mod.completedLessonCount}/${mod.lessonCount} lessons`}
                    </StatusPill>
                    <span className="font-display text-xs text-secondary">
                      {mod.attemptCount} attempt
                      {mod.attemptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/learn/${mod.slug}`}
                  className="mt-4 inline-block font-display text-sm font-semibold text-primary-text hover:underline"
                >
                  Open module →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
