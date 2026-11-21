"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";

/**
 * The words members read in one lesson. They are kept as a page of content
 * (the same kind Admin → Content edits); a lesson that has no page yet gets
 * one the first time its text is saved.
 */
export function LessonTextEditor({
  lesson,
  onSaved,
  onCancel,
}: {
  lesson: { id: string; title: string; html: string };
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const { provider } = useData();
  const [html, setHtml] = useState(lesson.html);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelId = `lesson-text-label-${lesson.id}`;

  async function save() {
    setPending(true);
    setError(null);
    try {
      await provider.adminSaveLessonText(lesson.id, html);
      onSaved("Lesson text saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the text.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 max-w-3xl space-y-3 rounded-2xl border border-border bg-surface/60 p-4">
      <p id={labelId} className="font-display text-sm font-medium text-brown">
        Text of “{lesson.title}”
      </p>
      <RichTextEditor
        key={lesson.id}
        initialHtml={lesson.html}
        labelledBy={labelId}
        onChange={setHtml}
      />
      {lesson.html ? null : (
        <p className="text-sm text-secondary">
          This lesson has no text yet. Members see only its videos.
        </p>
      )}
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
          {pending ? "Saving…" : "Save lesson text"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>
    </div>
  );
}
