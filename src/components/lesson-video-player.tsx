"use client";

import { useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import type { LessonVideo, VideoRole } from "@/lib/data";

const ROLE_LABEL: Record<VideoRole, string> = {
  primary: "Required",
  supporting: "Supporting",
  conditional: "Conditional",
};

const ROLE_TONE: Record<VideoRole, "warn" | "info" | "muted"> = {
  primary: "warn",
  supporting: "info",
  conditional: "muted",
};

export type LessonVideoPlayerProps = {
  video: LessonVideo & { watched?: boolean };
  watched?: boolean;
  onMarkWatched?: () => void | Promise<void>;
  pending?: boolean;
};

export function LessonVideoPlayer({
  video,
  watched: watchedProp,
  onMarkWatched,
  pending = false,
}: LessonVideoPlayerProps) {
  const watched = watchedProp ?? video.watched ?? false;
  const [embedFailed, setEmbedFailed] = useState(false);
  const embedSrc = `https://www.youtube-nocookie.com/embed/${video.youtubeId}`;

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="relative aspect-video w-full bg-brown/10">
        {embedFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-display text-sm text-secondary">
              Video couldn’t load here.
            </p>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-sm font-semibold text-primary-text underline"
            >
              Open on YouTube
            </a>
          </div>
        ) : (
          <iframe
            title={video.title}
            src={embedSrc}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setEmbedFailed(true)}
          />
        )}
      </div>

      <figcaption className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-brown">
              {video.title}
            </p>
            <p className="mt-1 text-sm text-secondary">{video.channel}</p>
          </div>
          <StatusPill tone={ROLE_TONE[video.role]}>
            {ROLE_LABEL[video.role]}
          </StatusPill>
        </div>

        {video.condition ? (
          <p className="text-sm text-secondary leading-relaxed">
            Watch if: {video.condition}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {watched ? (
            <StatusPill tone="ok" aria-label="Marked as watched">
              Watched ✓
            </StatusPill>
          ) : onMarkWatched ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => void onMarkWatched()}
            >
              {pending ? "Saving…" : "Mark as watched"}
            </Button>
          ) : null}

          {!embedFailed ? (
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-sm font-medium text-secondary underline hover:text-brown"
            >
              Open on YouTube
            </a>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
