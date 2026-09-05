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
  Question,
} from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AdminLearnModulePage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const { provider, revision, bump } = useData();

  const [mod, setMod] = useState<LearningModuleDetail | null | undefined>(
    undefined,
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const list = await provider.listModules();
      const view: LearningModuleView | undefined = list.find(
        (m) => m.id === moduleId,
      );
      if (!view) {
        setMod(null);
        setQuestions([]);
        return;
      }
      const detail = await provider.getModule(view.slug);
      setMod(detail);
      setQuestions(await provider.adminListQuestions(moduleId));
    })();
  }, [provider, revision, moduleId]);

  async function togglePublish() {
    if (!mod) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminPublishModule(mod.id, !mod.published);
      bump();
      setMessage(mod.published ? "Unpublished." : "Published.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update publish");
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

      <section>
        <h2 className="font-display text-xl font-semibold text-brown">
          Lessons
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {mod.lessons.map((lesson) => (
            <li key={lesson.id} className="py-3">
              <p className="font-display font-semibold text-brown">
                {lesson.sortOrder}. {lesson.title}
              </p>
              <p className="text-sm text-secondary">
                {lesson.slug} · content {lesson.contentSlug} ·{" "}
                {lesson.estimatedMinutes} min
              </p>
            </li>
          ))}
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
              placeholder="lesson-laser-safety"
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
                placeholder="10"
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
          Questions
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {questions.map((q) => (
            <li key={q.id} className="py-3">
              <p className="font-display font-semibold text-brown">{q.prompt}</p>
              <p className="mt-1 text-sm text-secondary">
                Correct: {q.choices[q.correctIndex] ?? `index ${q.correctIndex}`}
                {q.active ? "" : " · inactive"}
              </p>
            </li>
          ))}
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
