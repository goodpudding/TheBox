"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import {
  AddVideoForm,
  VIDEO_ROLE_LABEL,
} from "@/components/admin/learn/add-video-form";
import { LessonTextEditor } from "@/components/admin/learn/lesson-text-editor";
import { ModuleSettingsForm } from "@/components/admin/learn/module-settings-form";
import {
  QuestionForm,
  rightAnswers,
} from "@/components/admin/learn/question-form";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Certification,
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
  const [certs, setCerts] = useState<Certification[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [textLessonId, setTextLessonId] = useState<string | null>(null);

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
      const [detail, qs, vids, ready, certList] = await Promise.all([
        provider.getModule(view.slug),
        provider.adminListQuestions(moduleId),
        provider.adminListVideos(moduleId),
        provider.getModulePublishReadiness(moduleId),
        provider.adminListCertifications(),
      ]);
      setCerts(certList);
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
        // The pointer to the lesson's text is kept as it is. "Edit lesson
        // text" is how the text changes.
        contentSlug: lesson.contentSlug,
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
        condition: String(form.get("condition") ?? ""),
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

  /** A change one of the smaller forms made: show its line and load again. */
  function changed(text: string) {
    setError(null);
    setBlockers(null);
    setMessage(text);
    bump();
  }

  async function remove(
    question: string,
    done: string,
    action: () => Promise<void>,
  ) {
    if (!window.confirm(question)) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setEditingLessonId(null);
      setEditingVideoId(null);
      setEditingQuestionId(null);
      setTextLessonId(null);
      bump();
      setMessage(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove it.");
    } finally {
      setPending(false);
    }
  }

  function removeLesson(lesson: Lesson, videoCount: number) {
    const also =
      videoCount > 0
        ? ` Its ${videoCount === 1 ? "video goes" : `${videoCount} videos go`} with it, and so do the records of who watched and finished it.`
        : " The records of who finished it go with it.";
    return remove(
      `Remove the lesson “${lesson.title}”?${also} Certifications members already hold are not affected.`,
      "Lesson removed.",
      () => provider.adminDeleteLesson(lesson.id),
    );
  }

  function removeVideo(video: LessonVideo) {
    return remove(
      `Remove the video “${video.title}”? The records of who watched it go with it.`,
      "Video removed.",
      () => provider.adminDeleteVideo(video.id),
    );
  }

  function removeQuestion(q: Question) {
    return remove(
      "Remove this question for good? To keep it but stop asking it, untick “In use” instead.",
      "Question removed.",
      () => provider.adminDeleteQuestion(q.id),
    );
  }

  async function onAddLesson(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // React clears currentTarget once the handler first waits, so keep the form.
    const formEl = e.currentTarget;
    if (!mod) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(formEl);
    try {
      await provider.adminUpsertLesson({
        moduleId: mod.id,
        title: String(form.get("title") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim() || undefined,
        // Left blank: the lesson gets a page of its own when its text is
        // first written.
        contentSlug: "",
        sortOrder: Number(form.get("sortOrder") ?? 0) || undefined,
        estimatedMinutes:
          Number(form.get("estimatedMinutes") ?? 0) || undefined,
      });
      bump();
      setMessage("Lesson added.");
      formEl.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add lesson");
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditingDetails((open) => !open)}
          aria-expanded={editingDetails}
        >
          {editingDetails ? "Close module details" : "Edit module details"}
        </Button>
      </div>

      {editingDetails ? (
        <div className="mb-8">
          <ModuleSettingsForm
            key={mod.id}
            module={mod}
            certifications={certs}
            readiness={readiness}
            onSaved={() => {
              setBlockers(null);
              bump();
            }}
          />
        </div>
      ) : null}

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
        Click a lesson, video, or question to change or remove it. Lesson minutes
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
                    {lesson.slug} · {lesson.html ? "has text" : "no text yet"} ·{" "}
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setTextLessonId(
                            textLessonId === lesson.id ? null : lesson.id,
                          )
                        }
                      >
                        Edit lesson text
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          void removeLesson(lesson, lessonVids.length)
                        }
                      >
                        Remove lesson
                      </Button>
                    </div>
                  </form>
                ) : null}
                {editing && textLessonId === lesson.id ? (
                  <LessonTextEditor
                    lesson={lesson}
                    onSaved={changed}
                    onCancel={() => setTextLessonId(null)}
                  />
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
            <Label htmlFor="lesson-slug">Address (optional)</Label>
            <Input
              id="lesson-slug"
              name="slug"
              placeholder="made from the title"
            />
          </div>
          <p className="text-sm text-secondary">
            Add the lesson, then open it and choose “Edit lesson text” to
            write what members read.
          </p>
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
                      {lessonTitle(video.lessonId)} ·{" "}
                      {VIDEO_ROLE_LABEL[video.role].split(":")[0]}
                      {video.channel ? ` · ${video.channel}` : ""} ·{" "}
                      {formatDuration(video.durationSeconds)}
                      {video.condition ? ` · ${video.condition}` : ""}
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
                      <Label htmlFor={`vid-condition-${video.id}`}>
                        Who should watch it (for a video only some members need)
                      </Label>
                      <Input
                        id={`vid-condition-${video.id}`}
                        name="condition"
                        defaultValue={video.condition ?? ""}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => void removeVideo(video)}
                      >
                        Remove video
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
        <AddVideoForm lessons={mod.lessons} onSaved={changed} />
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
                    {rightAnswers(q).length > 1 ? "Right answers: " : "Right answer: "}
                    {rightAnswers(q)
                      .map((i) => q.choices[i] ?? `choice ${i + 1}`)
                      .join(" · ")}
                    {q.active ? "" : " · inactive"}
                    {q.safetyCritical ? " · safety-critical" : ""}
                  </p>
                </button>
                {editing ? (
                  <QuestionForm
                    key={q.id}
                    moduleId={q.moduleId}
                    question={q}
                    onSaved={(text) => {
                      setEditingQuestionId(null);
                      changed(text);
                    }}
                    onCancel={() => setEditingQuestionId(null)}
                    onRemove={() => void removeQuestion(q)}
                  />
                ) : null}
              </li>
            );
          })}
          {questions.length === 0 ? (
            <li className="py-4 text-secondary">No questions yet.</li>
          ) : null}
        </ul>

        <QuestionForm moduleId={mod.id} onSaved={changed} />
      </section>
    </AdminShell>
  );
}
