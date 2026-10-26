"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import type { LearningModuleView } from "@/lib/data";

function statusPill(mod: LearningModuleView): {
  tone: "ok" | "info" | "muted" | "warn";
  label: string;
} {
  switch (mod.memberStatus) {
    case "certified":
      return { tone: "ok", label: "Certified" };
    case "knowledge_passed_needs_checkoff":
      return mod.knowledgeOnly
        ? { tone: "ok", label: "Knowledge certified" }
        : { tone: "info", label: "Needs checkoff" };
    case "quiz_ready":
      return { tone: "info", label: "Quiz ready" };
    case "in_progress":
      return { tone: "info", label: "In progress" };
    default:
      return { tone: "muted", label: "Not started" };
  }
}

function moduleCta(mod: LearningModuleView): { href: string; label: string } {
  switch (mod.memberStatus) {
    case "certified":
      return { href: `/learn/${mod.slug}`, label: "View module →" };
    case "knowledge_passed_needs_checkoff":
      return mod.knowledgeOnly
        ? { href: `/learn/${mod.slug}`, label: "View module →" }
        : {
            href: `/learn/${mod.slug}`,
            label: "Awaiting hands-on checkoff →",
          };
    case "quiz_ready":
      return { href: `/learn/${mod.slug}/quiz`, label: "Take quiz →" };
    case "in_progress":
      return { href: `/learn/${mod.slug}`, label: "Continue module →" };
    default:
      return { href: `/learn/${mod.slug}`, label: "Start module →" };
  }
}

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

  const published = modules.filter((m) => m.published);

  return (
    <PageShell>
      <PageHero
        eyebrow="Learn"
        title="Skills path"
        description="One path per machine skill: watch the primary videos, pass the quiz, then complete a hands-on checkoff with staff or a tool champion. Progress and badges live here."
      />

      {loading ? (
        <p className="mt-10 text-secondary">Loading modules…</p>
      ) : published.length === 0 ? (
        <p className="mt-10 max-w-xl text-secondary leading-relaxed">
          No published modules yet. Draft modules aren’t visible to members
          until staff publish them.
        </p>
      ) : (
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {published.map((mod) => {
            const pill = statusPill(mod);
            const cta = moduleCta(mod);
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
                    <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                    <span className="font-display text-xs text-secondary">
                      {mod.completedLessonCount}/{mod.lessonCount} lessons ·{" "}
                      {mod.attemptCount} attempt
                      {mod.attemptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <Link
                  href={cta.href}
                  className="mt-4 inline-block font-display text-sm font-semibold text-primary-text hover:underline"
                >
                  {cta.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
