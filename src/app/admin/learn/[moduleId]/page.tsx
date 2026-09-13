"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  LearningModuleDetail,
  LearningModuleView,
  Lesson,
  LessonVideo,
  ModulePublishReadiness,
  PublishBlocker,
  Question,
  VideoRole,
} from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const textareaClass =
  "flex min-h-[5rem] w-full rounded-2xl border border-border bg-surface px-4 py-3 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const BLOCKER_LABEL: Record<PublishBlocker, string> = {
  answerPending: "Questions still marked answer-pending",
  primaryVideoUnreviewed: "Primary videos need staff review",
  equipmentUnconfirmed: "Equipment status is unconfirmed",
  gapLesson: "Gap/placeholder lessons still present",
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "unknown length";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}

function minutesFromVideos(vids: LessonVideo[]): {
  minutes: number;
  knownCount: number;
  unknownCount: number;
} {
  let seconds = 0;
  let knownCount = 0;
  let unknownCount = 0;
  for (const v of vids) {
    if (v.durationSeconds != null && v.durationSeconds > 0) {
      seconds += v.durationSeconds;
      knownCount += 1;
    } else {
      unknownCount += 1;
      seconds += 8 * 60;
    }
  }
  return {
    minutes: Math.max(1, Math.round(seconds / 60) + (vids.length ? 2 : 0)),
    knownCount,
    unknownCount,
  };
}

export default function AdminLearnModulePage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const { provider, revision, bump } = useData();

  const [mod, setMod] = useState<LearningModuleDetail | null | undefined>(
    undefined,
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [videos, setVideos] = useState<LessonVideo[]>([]);
  const [readiness, setReadiness] = useState<ModulePublishReadiness | null>(
    null,
  );
  const [blockers, setBlockers] = useState<PublishBlocker[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      const list = await provider.listModules();
      const view: LearningModuleView | undefined = list.find(
        (m) => m.id === moduleId,
      );
      if (!view) {
        setMod(null);
        setQuestions([]);
        setVideos([]);
        setReadiness(null);
        return;
      }
      const [detail, qs, vids, ready] = await Promise.all([
        provider.getModule(view.slug),
        provider.adminListQuestions(moduleId),
        provider.adminListVideos(moduleId),
        provider.getModulePublishReadiness(moduleId),
      ]);
      setMod(detail);
      setQuestions(qs);
      setVideos(vids);
      setReadiness(ready);
    })();
  }, [provider, revision, moduleId]);

  async function togglePublish() {
    if (!mod) return;
    setPending(true);
    setError(null);
    setMessage(null);
    setBlockers(null);
    try {
      const res = await provider.adminPublishModule(mod.id, !mod.published);
      if (res.ok) {
        bump();
        setMessage(mod.published ? "Unpublished." : "Published.");
        setBlockers(null);
      } else {
        setReadiness(res.readiness);
        setBlockers(res.reasons);
        setError(
          mod.published
            ? "Could not unpublish."
            : "Publish blocked — fix the items below.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update publish");
    } finally {
      setPending(false);
    }
  }

  async function toggleVideoReviewed(video: LessonVideo) {
    setPending(true);
    setError(null);
    try {
      await provider.adminSetVideoReviewed(video.id, !video.staffReviewed);
      bump();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update video review",
      );
    } finally {
      setPending(false);
    }
  }

  async function saveLesson(lesson: Lesson, form: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminUpsertLesson({
        id: lesson.id,
        moduleId: lesson.moduleId,
        title: String(form.get("title") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        contentSlug: String(form.get("contentSlug") ?? "").trim(),
        sortOrder: Number(form.get("sortOrder") ?? lesson.sortOrder),
        estimatedMinutes: Number(
          form.get("estimatedMinutes") ?? lesson.estimatedMinutes,
        ),
        gap: form.get("gap") === "on",
      });
      setEditingLessonId(null);
      bump();
      setMessage("Lesson saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lesson");
    } finally {
      setPending(false);
    }
  }

  async function saveVideo(video: LessonVideo, form: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const youtubeId = String(form.get("youtubeId") ?? "").trim();
      const durationRaw = String(form.get("durationSeconds") ?? "").trim();
      await provider.adminUpsertVideo({
        id: video.id,
        lessonId: String(form.get("lessonId") ?? video.lessonId),
        title: String(form.get("title") ?? "").trim(),
        youtubeId,
        url:
          String(form.get("url") ?? "").trim() ||
          `https://www.youtube.com/watch?v=${youtubeId}`,
        channel: String(form.get("channel") ?? "").trim(),
        role: String(form.get("role") ?? video.role) as VideoRole,
        order: Number(form.get("order") ?? video.order),
        durationSeconds: durationRaw === "" ? null : Number(durationRaw),
        notes: String(form.get("notes") ?? "") || null,
        staffReviewed: form.get("staffReviewed") === "on",
      });
      setEditingVideoId(null);
      bump();
      setMessage("Video saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save video");
    } finally {
      setPending(false);
    }
  }

  async function saveQuestion(q: Question, form: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const choices = [0, 1, 2, 3].map((i) =>
        String(form.get(`choice${i}`) ?? "").trim(),
      );
      const correctIndex = Number(form.get("correctIndex") ?? 0);
      await provider.adminUpsertQuestion({
        id: q.id,
        moduleId: q.moduleId,
        prompt: String(form.get("prompt") ?? "").trim(),
        choices,
        correctIndex,
        correctIndexes: [correctIndex],
        explanation: String(form.get("explanation") ?? ""),
        active: form.get("active") === "on",
        safetyCritical: form.get("safetyCritical") === "on",
        answerPending: form.get("answerPending") === "on",
        source: form.get("source") === "shop-policy" ? "shop-policy" : "video",
        verifyAgainstVideo: form.get("verifyAgainstVideo") === "on",
      });
      setEditingQuestionId(null);
      bump();
      setMessage("Question saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save question");
    } finally {
      setPending(false);
    }
  }

  async function onAddLesson(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mod) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      await provider.adminUpsertLesson({
        moduleId: mod.id,
        title: String(form.get("title") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        contentSlug: String(form.get("contentSlug") ?? "").trim(),
        sortOrder: Number(form.get("sortOrder") ?? 0) || undefined,
        estimatedMinutes:
          Number(form.get("estimatedMinutes") ?? 0) || undefined,
      });
      bump();
      setMessage("Lesson added.");
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add lesson");
    } finally {
      setPending(false);
    }
  }

  async function onAddQuestion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mod) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const choices = [0, 1, 2, 3].map((i) =>
      String(form.get(`choice${i}`) ?? "").trim(),
    );
    try {
      await provider.adminUpsertQuestion({
        moduleId: mod.id,
        prompt: String(form.get("prompt") ?? "").trim(),
        choices,
        correctIndex: Number(form.get("correctIndex") ?? 0),
      });
      bump();
      setMessage("Question added.");
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add question");
    } finally {
      setPending(false);
    }
  }

  if (mod === undefined) {
    return (
      <AdminShell title="Module">
        <p className="text-secondary">Loading…</p>
      </AdminShell>
    );
  }

  if (mod === null) {
    return (
      <AdminShell title="Module not found">
        <p className="text-secondary">No module with that id.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/admin/learn">Back to modules</Link>
        </Button>
      </AdminShell>
    );
  }

  const lessonTitle = (lessonId: string) =>
    mod.lessons.find((l) => l.id === lessonId)?.title ?? lessonId;

  return (
    <AdminShell
      title={mod.title}
      description={`${mod.slug} · linked to ${mod.certification.name}`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/learn">← Modules</Link>
        </Button>
        <StatusPill tone={mod.published ? "ok" : "muted"}>
          {mod.published ? "Published" : "Draft"}
        </StatusPill>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void togglePublish()}
        >
          {mod.published ? "Unpublish" : "Publish"}
        </Button>
      </div>

      {readiness ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {readiness.canPublish ? (
            <StatusPill tone="ok">Ready to publish</StatusPill>
          ) : (
            <StatusPill tone="warn">Not ready</StatusPill>
          )}
          {readiness.answerPendingCount > 0 ? (
            <StatusPill tone="warn">
              {readiness.answerPendingCount} pending answers
            </StatusPill>
          ) : null}
          {readiness.unreviewedPrimaryVideoCount > 0 ? (
            <StatusPill tone="warn">
              {readiness.unreviewedPrimaryVideoCount} unreviewed videos
            </StatusPill>
          ) : null}
          {readiness.gapLessonCount > 0 ? (
            <StatusPill tone="warn">
              {readiness.gapLessonCount} gap lessons
            </StatusPill>
          ) : null}
          {readiness.equipmentUnconfirmed ? (
            <StatusPill tone="warn">Equipment unconfirmed</StatusPill>
          ) : null}
        </div>
      ) : null}

      {blockers && blockers.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          <p className="font-display text-sm font-semibold">Publish blockers</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {blockers.map((b) => (
              <li key={b}>{BLOCKER_LABEL[b]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-brown">
          {message}
        </p>
      ) : null}

      <p className="mb-8 text-sm text-secondary">
        Click a lesson, video, or question to edit it inline. Lesson minutes
        should reflect video runtime (plus a short reading pad); many YouTube
        lengths are still unknown, so those use an 8‑minute placeholder until
        you enter a duration.
      </p>

      <section>
        <h2 className="font-display text-xl font-semibold text-brown">
          Lessons
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {mod.lessons.map((lesson) => {
            const lessonVids = videos.filter((v) => v.lessonId === lesson.id);
            const fromVids = minutesFromVideos(lessonVids);
            const editing = editingLessonId === lesson.id;
            return (
              <li key={lesson.id} className="py-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    setEditingLessonId(editing ? null : lesson.id)
                  }
                >
                  <p className="font-display font-semibold text-brown">
                    {lesson.sortOrder}. {lesson.title}
                    {lesson.gap ? (
                      <span className="ml-2">
                        <StatusPill tone="warn">Gap</StatusPill>
                      </span>
                    ) : null}
                    <span className="ml-2 font-display text-xs font-normal text-primary-text">
                      {editing ? "Close" : "Edit"}
                    </span>
                  </p>
                  <p className="text-sm text-secondary">
                    {lesson.slug} · content {lesson.contentSlug} ·{" "}
                    {lesson.estimatedMinutes} min stored
                    {lessonVids.length > 0 ? (
                      <>
                        {" "}
                        · ~{fromVids.minutes} min from videos
                        {fromVids.unknownCount > 0
                          ? ` (${fromVids.unknownCount} length unknown)`
                          : ""}
                      </>
                    ) : (
                      " · text-only"
                    )}
                  </p>
                </button>
                {editing ? (
                  <form
                    className="mt-4 max-w-xl space-y-3 rounded-2xl border border-border bg-surface/60 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveLesson(lesson, new FormData(e.currentTarget));
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`les-title-${lesson.id}`}>Title</Label>
                      <Input
                        id={`les-title-${lesson.id}`}
                        name="title"
                        defaultValue={lesson.title}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`les-slug-${lesson.id}`}>Slug</Label>
                      <Input
                        id={`les-slug-${lesson.id}`}
                        name="slug"
                        defaultValue={lesson.slug}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`les-content-${lesson.id}`}>
                        Content slug
                      </Label>
                      <Input
                        id={`les-content-${lesson.id}`}
                        name="contentSlug"
                        defaultValue={lesson.contentSlug}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`les-order-${lesson.id}`}>
                          Sort order
                        </Label>
                        <Input
                          id={`les-order-${lesson.id}`}
                          name="sortOrder"
                          type="number"
                          min={1}
                          defaultValue={lesson.sortOrder}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`les-mins-${lesson.id}`}>
                          Estimated minutes
                        </Label>
                        <Input
                          id={`les-mins-${lesson.id}`}
                          name="estimatedMinutes"
                          type="number"
                          min={0}
                          defaultValue={lesson.estimatedMinutes}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 font-display text-sm text-brown">
                      <input
                        type="checkbox"
                        name="gap"
                        className="size-4"
                        defaultChecked={Boolean(lesson.gap)}
                      />
                      Gap / placeholder lesson (blocks publish)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={pending} size="sm">
                        Save lesson
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingLessonId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
          {mod.lessons.length === 0 ? (
            <li className="py-4 text-secondary">No lessons yet.</li>
          ) : null}
        </ul>

        <form onSubmit={onAddLesson} className="mt-6 max-w-xl space-y-4">
          <h3 className="font-display text-lg font-semibold text-brown">
            Add lesson
          </h3>
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-slug">Slug</Label>
            <Input id="lesson-slug" name="slug" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contentSlug">Content slug</Label>
            <Input
              id="contentSlug"
              name="contentSlug"
              required
              placeholder="learn/module/lesson"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={1}
                placeholder="auto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedMinutes">Minutes</Label>
              <Input
                id="estimatedMinutes"
                name="estimatedMinutes"
                type="number"
                min={1}
                placeholder="auto"
              />
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            Add lesson
          </Button>
        </form>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold text-brown">
          Videos
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {videos.map((video) => {
            const editing = editingVideoId === video.id;
            return (
              <li key={video.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setEditingVideoId(editing ? null : video.id)
                    }
                  >
                    <p className="font-display font-semibold text-brown">
                      {video.title}
                      <span className="ml-2 font-display text-xs font-normal text-primary-text">
                        {editing ? "Close" : "Edit"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      {lessonTitle(video.lessonId)} · {video.role} ·{" "}
                      {video.channel} · {formatDuration(video.durationSeconds)}
                    </p>
                  </button>
                  <label
                    className="flex items-center gap-2 font-display text-sm text-brown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={video.staffReviewed}
                      disabled={pending}
                      onChange={() => void toggleVideoReviewed(video)}
                    />
                    Staff reviewed
                  </label>
                </div>
                {editing ? (
                  <form
                    className="mt-4 max-w-xl space-y-3 rounded-2xl border border-border bg-surface/60 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveVideo(video, new FormData(e.currentTarget));
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`vid-title-${video.id}`}>Title</Label>
                      <Input
                        id={`vid-title-${video.id}`}
                        name="title"
                        defaultValue={video.title}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vid-channel-${video.id}`}>Channel</Label>
                      <Input
                        id={`vid-channel-${video.id}`}
                        name="channel"
                        defaultValue={video.channel}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vid-yt-${video.id}`}>YouTube ID</Label>
                      <Input
                        id={`vid-yt-${video.id}`}
                        name="youtubeId"
                        defaultValue={video.youtubeId}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vid-url-${video.id}`}>URL</Label>
                      <Input
                        id={`vid-url-${video.id}`}
                        name="url"
                        defaultValue={video.url}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vid-lesson-${video.id}`}>Lesson</Label>
                      <select
                        id={`vid-lesson-${video.id}`}
                        name="lessonId"
                        className={selectClass}
                        defaultValue={video.lessonId}
                      >
                        {mod.lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`vid-role-${video.id}`}>Role</Label>
                        <select
                          id={`vid-role-${video.id}`}
                          name="role"
                          className={selectClass}
                          defaultValue={video.role}
                        >
                          <option value="primary">primary</option>
                          <option value="supporting">supporting</option>
                          <option value="conditional">conditional</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`vid-order-${video.id}`}>Order</Label>
                        <Input
                          id={`vid-order-${video.id}`}
                          name="order"
                          type="number"
                          min={1}
                          defaultValue={video.order}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vid-dur-${video.id}`}>
                        Duration (seconds)
                      </Label>
                      <Input
                        id={`vid-dur-${video.id}`}
                        name="durationSeconds"
                        type="number"
                        min={0}
                        placeholder="Leave blank if unknown"
                        defaultValue={video.durationSeconds ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vid-notes-${video.id}`}>Notes</Label>
                      <textarea
                        id={`vid-notes-${video.id}`}
                        name="notes"
                        className={textareaClass}
                        defaultValue={video.notes ?? ""}
                      />
                    </div>
                    <label className="flex items-center gap-2 font-display text-sm text-brown">
                      <input
                        type="checkbox"
                        name="staffReviewed"
                        className="size-4"
                        defaultChecked={video.staffReviewed}
                      />
                      Staff reviewed
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={pending} size="sm">
                        Save video
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingVideoId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
          {videos.length === 0 ? (
            <li className="py-4 text-secondary">No videos yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold text-brown">
          Questions
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {questions.map((q) => {
            const editing = editingQuestionId === q.id;
            return (
              <li key={q.id} className="py-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    setEditingQuestionId(editing ? null : q.id)
                  }
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="font-display font-semibold text-brown">
                      {q.prompt}
                      <span className="ml-2 font-display text-xs font-normal text-primary-text">
                        {editing ? "Close" : "Edit"}
                      </span>
                    </p>
                    {q.answerPending ? (
                      <StatusPill tone="warn">Answer pending</StatusPill>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    Correct:{" "}
                    {q.choices[q.correctIndex] ?? `index ${q.correctIndex}`}
                    {q.active ? "" : " · inactive"}
                    {q.safetyCritical ? " · safety-critical" : ""}
                  </p>
                </button>
                {editing ? (
                  <form
                    className="mt-4 max-w-xl space-y-3 rounded-2xl border border-border bg-surface/60 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveQuestion(q, new FormData(e.currentTarget));
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`q-prompt-${q.id}`}>Prompt</Label>
                      <textarea
                        id={`q-prompt-${q.id}`}
                        name="prompt"
                        className={textareaClass}
                        defaultValue={q.prompt}
                        required
                      />
                    </div>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Label htmlFor={`q-choice-${q.id}-${i}`}>
                          Choice {i + 1}
                          {i === q.correctIndex ? " (current correct)" : ""}
                        </Label>
                        <Input
                          id={`q-choice-${q.id}-${i}`}
                          name={`choice${i}`}
                          defaultValue={q.choices[i] ?? ""}
                          required
                        />
                      </div>
                    ))}
                    <div className="space-y-2">
                      <Label htmlFor={`q-correct-${q.id}`}>
                        Correct choice
                      </Label>
                      <select
                        id={`q-correct-${q.id}`}
                        name="correctIndex"
                        className={selectClass}
                        defaultValue={String(q.correctIndex)}
                      >
                        <option value="0">Choice 1</option>
                        <option value="1">Choice 2</option>
                        <option value="2">Choice 3</option>
                        <option value="3">Choice 4</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`q-expl-${q.id}`}>Explanation</Label>
                      <textarea
                        id={`q-expl-${q.id}`}
                        name="explanation"
                        className={textareaClass}
                        defaultValue={q.explanation ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`q-source-${q.id}`}>Source</Label>
                      <select
                        id={`q-source-${q.id}`}
                        name="source"
                        className={selectClass}
                        defaultValue={q.source}
                      >
                        <option value="video">video</option>
                        <option value="shop-policy">shop-policy</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 font-display text-sm text-brown">
                      <input
                        type="checkbox"
                        name="safetyCritical"
                        className="size-4"
                        defaultChecked={q.safetyCritical}
                      />
                      Safety-critical
                    </label>
                    <label className="flex items-center gap-2 font-display text-sm text-brown">
                      <input
                        type="checkbox"
                        name="answerPending"
                        className="size-4"
                        defaultChecked={q.answerPending}
                      />
                      Answer pending (blocks publish)
                    </label>
                    <label className="flex items-center gap-2 font-display text-sm text-brown">
                      <input
                        type="checkbox"
                        name="verifyAgainstVideo"
                        className="size-4"
                        defaultChecked={q.verifyAgainstVideo}
                      />
                      Verify against video
                    </label>
                    <label className="flex items-center gap-2 font-display text-sm text-brown">
                      <input
                        type="checkbox"
                        name="active"
                        className="size-4"
                        defaultChecked={q.active}
                      />
                      Active in bank
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={pending} size="sm">
                        Save question
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingQuestionId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
          {questions.length === 0 ? (
            <li className="py-4 text-secondary">No questions yet.</li>
          ) : null}
        </ul>

        <form onSubmit={onAddQuestion} className="mt-6 max-w-xl space-y-4">
          <h3 className="font-display text-lg font-semibold text-brown">
            Add question
          </h3>
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Input id="prompt" name="prompt" required />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Label htmlFor={`choice${i}`}>Choice {i + 1}</Label>
              <Input id={`choice${i}`} name={`choice${i}`} required />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="correctIndex">Correct choice</Label>
            <select
              id="correctIndex"
              name="correctIndex"
              className={selectClass}
              defaultValue="0"
            >
              <option value="0">Choice 1</option>
              <option value="1">Choice 2</option>
              <option value="2">Choice 3</option>
              <option value="3">Choice 4</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            Add question
          </Button>
        </form>
      </section>
    </AdminShell>
  );
}
