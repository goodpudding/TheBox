"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MemberGate } from "@/components/member-gate";
import { PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type { LearningModuleDetail } from "@/lib/data";

export default function LearnModulePage() {
  return (
    <MemberGate>
      <ModuleBody />
    </MemberGate>
  );
}

function ModuleBody() {
  const params = useParams<{ module: string }>();
  const { provider, currentUser, revision, bump } = useData();
  const [mod, setMod] = useState<LearningModuleDetail | null | undefined>(
    undefined,
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const detail = await provider.getModule(params.module);
    setMod(detail);
    if (detail && !activeLessonId && detail.lessons[0]) {
      setActiveLessonId(detail.lessons[0].id);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, revision, params.module]);

  if (mod === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading module…</p>
      </PageShell>
    );
  }

  if (mod === null) {
    return (
      <PageShell>
        <h1 className="font-display text-2xl font-semibold text-brown">
          Module not found
        </h1>
        <Link
          href="/learn"
          className="mt-4 inline-block font-display text-sm text-primary-text hover:underline"
        >
          ← All modules
        </Link>
      </PageShell>
    );
  }

  const active =
    mod.lessons.find((l) => l.id === activeLessonId) ?? mod.lessons[0];
  const allDone =
    mod.lessons.length > 0 && mod.lessons.every((l) => l.completed);
  const canQuiz = allDone && !mod.knowledgePassed;

  async function markComplete() {
    if (!currentUser || !active) return;
    setPending(true);
    setError(null);
    try {
      await provider.markLessonComplete(active.id, currentUser.id);
      bump();
      const detail = await provider.getModule(params.module);
      setMod(detail);
      if (detail) {
        const next = detail.lessons.find((l) => !l.completed);
        if (next) setActiveLessonId(next.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <Link
        href="/learn"
        className="font-display text-sm font-medium text-primary-text hover:underline"
      >
        ← All modules
      </Link>
      <p className="eyebrow mt-6">Learning module</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-brown sm:text-4xl">
        {mod.title}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-secondary leading-relaxed">
        {mod.summary}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill tone="info">{mod.certification.name}</StatusPill>
        {mod.knowledgeOnly ? (
          <StatusPill tone="muted">Knowledge-only</StatusPill>
        ) : null}
        {mod.knowledgePassed ? (
          <StatusPill tone="ok">Knowledge passed</StatusPill>
        ) : null}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <nav className="space-y-1">
          <p className="eyebrow mb-3">Lessons</p>
          {mod.lessons.map((lesson, i) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => setActiveLessonId(lesson.id)}
              className={
                active?.id === lesson.id
                  ? "w-full rounded-xl bg-primary/15 px-3 py-2.5 text-left font-display text-sm font-semibold text-brown"
                  : "w-full rounded-xl px-3 py-2.5 text-left font-display text-sm text-secondary hover:bg-surface hover:text-brown"
              }
            >
              <span className="text-xs text-secondary">{i + 1}. </span>
              {lesson.title}
              {lesson.completed ? (
                <span className="ml-1 text-primary-text">✓</span>
              ) : null}
            </button>
          ))}
          <div className="pt-4">
            {mod.knowledgePassed ? (
              <p className="text-sm text-secondary">
                Quiz passed.{" "}
                {!mod.knowledgeOnly
                  ? "Book a hands-on checkoff when ready."
                  : "You’re certified for this knowledge-only module."}
              </p>
            ) : canQuiz ? (
              <Button asChild className="w-full">
                <Link href={`/learn/${mod.slug}/quiz`}>Take quiz</Link>
              </Button>
            ) : (
              <p className="text-sm text-secondary">
                Finish every lesson to unlock the quiz.
              </p>
            )}
          </div>
        </nav>

        <article>
          {active ? (
            <>
              <h2 className="font-display text-2xl font-semibold text-brown">
                {active.title}
              </h2>
              <p className="mt-1 font-display text-xs uppercase tracking-wider text-secondary">
                ~{active.estimatedMinutes} min
              </p>
              <div
                className="prose-cms mt-6 max-w-3xl"
                dangerouslySetInnerHTML={{ __html: active.html }}
              />
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {active.completed ? (
                  <StatusPill tone="ok">Completed</StatusPill>
                ) : (
                  <Button type="button" onClick={markComplete} disabled={pending}>
                    {pending ? "Saving…" : "Mark lesson complete"}
                  </Button>
                )}
                {error ? (
                  <p className="text-sm text-accent" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-secondary">No lessons in this module.</p>
          )}
        </article>
      </div>
    </PageShell>
  );
}
