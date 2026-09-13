"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LessonVideoPlayer } from "@/components/lesson-video-player";
import { MemberGate } from "@/components/member-gate";
import { PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type { LearningModuleDetail } from "@/lib/data";

function memberStatusPill(mod: LearningModuleDetail): {
  tone: "ok" | "info" | "muted" | "warn";
  label: string;
} {
  switch (mod.memberStatus) {
    case "certified":
      return { tone: "ok", label: "Certified" };
    case "knowledge_passed_needs_checkoff":
      return mod.knowledgeOnly
        ? { tone: "ok", label: "Knowledge certified" }
        : {
            tone: "info",
            label: "Knowledge test passed — needs hands-on checkoff",
          };
    case "in_progress":
      return { tone: "info", label: "In progress" };
    default:
      return { tone: "muted", label: "Not started" };
  }
}

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
  const [watchingId, setWatchingId] = useState<string | null>(null);
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
  const canQuiz =
    mod.published &&
    mod.primaryVideosWatched &&
    !mod.knowledgePassed &&
    mod.attemptsRemaining > 0;
  const alreadyDone =
    mod.memberStatus === "knowledge_passed_needs_checkoff" ||
    mod.memberStatus === "certified";
  const status = memberStatusPill(mod);

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

  async function onMarkWatched(videoId: string) {
    if (!currentUser || !active) return;
    setWatchingId(videoId);
    setError(null);
    try {
      await provider.markVideoWatched(videoId, currentUser.id);
      const primaryVideos = active.videos.filter((v) => v.role === "primary");
      const allPrimaryWatched = primaryVideos.every(
        (v) => v.id === videoId || v.watched,
      );
      if (
        allPrimaryWatched &&
        primaryVideos.length > 0 &&
        !active.completed
      ) {
        await provider.markLessonComplete(active.id, currentUser.id);
      }
      bump();
      const detail = await provider.getModule(params.module);
      setMod(detail);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not mark video watched",
      );
    } finally {
      setWatchingId(null);
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
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
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
              {lesson.gap ? (
                <span className="ml-1 text-xs text-secondary">(draft)</span>
              ) : null}
              {lesson.completed ? (
                <span className="ml-1 text-primary-text">✓</span>
              ) : null}
            </button>
          ))}
          <div className="pt-4 space-y-2">
            {alreadyDone ? (
              <div className="space-y-3">
                <p className="text-sm text-secondary leading-relaxed">
                  {mod.knowledgeOnly
                    ? "Knowledge already recorded for this module — no quiz required."
                    : mod.memberStatus === "certified"
                      ? "You’re already certified. The quiz gate only appears for members who haven’t passed yet."
                      : "Knowledge test passed — needs hands-on checkoff. Book time with staff when ready."}
                </p>
                {mod.published && mod.attemptsRemaining > 0 ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/learn/${mod.slug}/quiz?practice=1`}>
                      Practice quiz
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : canQuiz ? (
              <Button asChild className="w-full">
                <Link href={`/learn/${mod.slug}/quiz`}>Take quiz</Link>
              </Button>
            ) : mod.attemptsRemaining === 0 && !mod.knowledgePassed ? (
              <p className="text-sm text-secondary leading-relaxed">
                No quiz attempts left. Book time with staff for help.
              </p>
            ) : !mod.published ? (
              <p className="text-sm text-secondary leading-relaxed">
                Module isn’t published yet — staff must unlock it before the
                quiz opens.
              </p>
            ) : !mod.primaryVideosWatched ? (
              <p className="text-sm text-secondary leading-relaxed">
                Watch all required (primary) videos to unlock the quiz.
              </p>
            ) : (
              <p className="text-sm text-secondary">Quiz unavailable.</p>
            )}
          </div>
        </nav>

        <article>
          {canQuiz ? (
            <div className="mb-8 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-4">
              <p className="font-display text-sm font-semibold text-brown">
                Quiz unlocked
              </p>
              <p className="mt-1 text-sm text-secondary leading-relaxed">
                You’ve watched the required videos. Pass the knowledge check
                before this skill counts toward certification.
              </p>
              <Button asChild className="mt-3">
                <Link href={`/learn/${mod.slug}/quiz`}>Take the quiz</Link>
              </Button>
            </div>
          ) : null}
          {active ? (
            <>
              <h2 className="font-display text-2xl font-semibold text-brown">
                {active.title}
              </h2>
              <p className="mt-1 font-display text-xs uppercase tracking-wider text-secondary">
                ~{active.estimatedMinutes} min
              </p>

              {active.gap ? (
                <p className="mt-6 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-secondary leading-relaxed">
                  This lesson is a placeholder — staff are still writing the
                  content. Required videos (if any) still count toward quiz
                  unlock.
                </p>
              ) : null}

              {active.videos.length > 0 ? (
                <div className="mt-8 space-y-6">
                  <p className="eyebrow">Videos</p>
                  {active.videos.map((video) => (
                    <LessonVideoPlayer
                      key={video.id}
                      video={video}
                      watched={video.watched}
                      pending={watchingId === video.id}
                      onMarkWatched={
                        currentUser
                          ? () => onMarkWatched(video.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : null}

              {!active.gap && active.html ? (
                <div
                  className="prose-cms mt-6 max-w-3xl"
                  dangerouslySetInnerHTML={{ __html: active.html }}
                />
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {active.completed ? (
                  <StatusPill tone="ok">Lesson complete</StatusPill>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={markComplete}
                    disabled={pending}
                  >
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
