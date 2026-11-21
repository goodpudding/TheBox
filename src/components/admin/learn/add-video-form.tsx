"use client";

import { useState, type FormEvent } from "react";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lesson, VideoRole } from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export const VIDEO_ROLE_LABEL: Record<VideoRole, string> = {
  primary: "Required: members watch it before the quiz",
  supporting: "Extra: worth watching, not required",
  conditional: "Only for some members",
};

/**
 * Add a YouTube video to a lesson. Staff paste the link; the video id is
 * read out of it when the video is saved.
 */
export function AddVideoForm({
  lessons,
  onSaved,
}: {
  lessons: Pick<Lesson, "id" | "title">[];
  onSaved: (message: string) => void;
}) {
  const { provider } = useData();
  const [lessonId, setLessonId] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState("");
  const [role, setRole] = useState<VideoRole>("primary");
  const [condition, setCondition] = useState("");
  const [minutes, setMinutes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLesson = lessonId || lessons[0]?.id || "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const mins = Number(minutes);
      await provider.adminUpsertVideo({
        lessonId: activeLesson,
        title,
        url,
        channel,
        role,
        condition: role === "conditional" ? condition : "",
        durationSeconds:
          minutes.trim() && Number.isFinite(mins) && mins > 0
            ? Math.round(mins * 60)
            : null,
      });
      setTitle("");
      setUrl("");
      setChannel("");
      setCondition("");
      setMinutes("");
      onSaved("Video added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the video.");
    } finally {
      setPending(false);
    }
  }

  if (lessons.length === 0) {
    return (
      <p className="mt-6 text-sm text-secondary">
        Add a lesson first. A video belongs to a lesson.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-6 max-w-xl space-y-4">
      <h3 className="font-display text-lg font-semibold text-brown">
        Add a video
      </h3>
      <div className="space-y-2">
        <Label htmlFor="new-video-lesson">Lesson</Label>
        <select
          id="new-video-lesson"
          value={activeLesson}
          onChange={(e) => setLessonId(e.target.value)}
          className={selectClass}
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-video-url">YouTube link</Label>
        <Input
          id="new-video-url"
          required
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-video-title">Title</Label>
        <Input
          id="new-video-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-video-channel">Channel (optional)</Label>
        <Input
          id="new-video-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-video-role">Who watches it</Label>
        <select
          id="new-video-role"
          value={role}
          onChange={(e) => setRole(e.target.value as VideoRole)}
          className={selectClass}
          aria-describedby="new-video-role-help"
        >
          {(Object.keys(VIDEO_ROLE_LABEL) as VideoRole[]).map((r) => (
            <option key={r} value={r}>
              {VIDEO_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <p id="new-video-role-help" className="text-sm text-secondary">
          A required video needs the “Staff reviewed” tick before the module
          can be published.
        </p>
      </div>
      {role === "conditional" ? (
        <div className="space-y-2">
          <Label htmlFor="new-video-condition">Who should watch it</Label>
          <Input
            id="new-video-condition"
            placeholder="Watch if you plan to cut acrylic"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="new-video-minutes">Length in minutes (optional)</Label>
        <Input
          id="new-video-minutes"
          inputMode="decimal"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add video"}
      </Button>
    </form>
  );
}
