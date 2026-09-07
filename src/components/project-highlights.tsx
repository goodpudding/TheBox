"use client";

import Image from "next/image";
import { PROJECT_HIGHLIGHTS, SOCIAL_LINKS } from "@/lib/social";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.5l.5-3H13V9c0-.6.4-1 1-1z" />
    </svg>
  );
}

type ProjectHighlightsProps = {
  limit?: number;
  /** When false, skip the section title (page already has a hero). */
  showHeading?: boolean;
};

export function ProjectHighlights({
  limit,
  showHeading = true,
}: ProjectHighlightsProps) {
  const items =
    limit != null ? PROJECT_HIGHLIGHTS.slice(0, limit) : PROJECT_HIGHLIGHTS;

  return (
    <div>
      {showHeading ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="eyebrow">Made at The Box</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
              Member project highlights
            </h2>
            <p className="mt-3 text-secondary leading-relaxed">
              A peek at what people are building in the shop. Follow along for
              more — and tag us when you finish something.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={SOCIAL_LINKS.instagram.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-brown/25 bg-surface px-4 py-2.5 font-display text-sm font-semibold text-brown transition-colors hover:border-brown/50 hover:bg-white"
            >
              <InstagramIcon className="h-4 w-4" />
              Instagram
            </a>
            <a
              href={SOCIAL_LINKS.facebook.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-brown/25 bg-surface px-4 py-2.5 font-display text-sm font-semibold text-brown transition-colors hover:border-brown/50 hover:bg-white"
            >
              <FacebookIcon className="h-4 w-4" />
              Facebook
            </a>
          </div>
        </div>
      ) : null}

      <ul
        className={`grid gap-8 sm:grid-cols-2 ${showHeading ? "mt-8" : ""}`}
      >
        {items.map((project) => (
          <li key={project.id} className="group">
            <div className="relative aspect-[4/3] overflow-hidden bg-brown/10">
              <Image
                src={project.imageSrc}
                alt={project.imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="mt-3">
              <p className="font-display text-lg font-semibold text-brown">
                {project.title}
              </p>
              <p className="mt-1 font-display text-sm text-secondary">
                {project.maker} · {project.area}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-secondary">
                {project.caption}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-10 max-w-2xl text-sm text-secondary">
        Want your build featured? Share it on{" "}
        <a
          href={SOCIAL_LINKS.instagram.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-text underline underline-offset-2"
        >
          Instagram
        </a>{" "}
        or{" "}
        <a
          href={SOCIAL_LINKS.facebook.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-text underline underline-offset-2"
        >
          Facebook
        </a>{" "}
        and tell staff — we only post member work with permission.
      </p>
    </div>
  );
}

export function SocialLinks({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const linkClass =
    tone === "dark"
      ? "inline-flex items-center gap-2 hover:text-primary transition-colors"
      : "inline-flex items-center gap-2 text-brown hover:text-primary-text transition-colors";

  return (
    <div
      className={`flex flex-wrap gap-x-5 gap-y-2 font-display text-sm ${className}`}
    >
      <a
        href={SOCIAL_LINKS.instagram.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <InstagramIcon className="h-4 w-4" />
        Instagram
      </a>
      <a
        href={SOCIAL_LINKS.facebook.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <FacebookIcon className="h-4 w-4" />
        Facebook
      </a>
    </div>
  );
}
