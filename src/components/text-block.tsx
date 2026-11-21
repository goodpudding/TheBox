"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/providers";
import { cn } from "@/lib/utils";
import type { DataProvider } from "@/lib/data";
import {
  fillTextBlock,
  inlineTextBlock,
  textBlockHtml,
  textBlockPlainText,
} from "@/lib/data/text-blocks";

type Values = Record<string, string | number | null | undefined>;

/** Every block on a page asks at once. One request serves them all. */
let shared: {
  provider: DataProvider;
  revision: number;
  blocks: Promise<Record<string, string>>;
} | null = null;

function loadTextBlocks(
  provider: DataProvider,
  revision: number,
): Promise<Record<string, string>> {
  if (!shared || shared.provider !== provider || shared.revision !== revision) {
    shared = { provider, revision, blocks: provider.listTextBlocks() };
  }
  return shared.blocks;
}

const NOTHING_SAVED: Record<string, string> = {};

/** The blocks staff have changed. Empty until the answer arrives. */
function useSavedTextBlocks(): Record<string, string> {
  const { provider, revision } = useData();
  const [saved, setSaved] = useState<Record<string, string>>(NOTHING_SAVED);

  useEffect(() => {
    let cancelled = false;
    loadTextBlocks(provider, revision)
      .then((next) => {
        if (!cancelled) setSaved(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  return saved;
}

/**
 * A piece of page text staff can change under Admin → Content. Shows what
 * they saved, or the built-in wording from text-blocks.ts until they do.
 *
 * As a "div" (the default) it stands where a paragraph stood and takes that
 * paragraph's classes. As a "span" it sits inside a sentence or a heading
 * line that the page already wraps.
 *
 * Saved text was cleaned when it was saved, and the built-in text is ours.
 * Values are escaped before they go in.
 */
export function TextBlock({
  slug,
  className,
  values,
  as = "div",
}: {
  slug: string;
  className?: string;
  values?: Values;
  as?: "div" | "span";
}) {
  const saved = useSavedTextBlocks();
  const html = fillTextBlock(textBlockHtml(slug, saved), values ?? {});
  if (as === "span") {
    return (
      <span
        className={cn("page-text", className)}
        dangerouslySetInnerHTML={{ __html: inlineTextBlock(html) }}
      />
    );
  }
  return (
    <div
      className={cn("page-text", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The same words as plain text, for a place a tag cannot go. */
export function useTextBlockText(slug: string, values?: Values): string {
  const saved = useSavedTextBlocks();
  return textBlockPlainText(fillTextBlock(textBlockHtml(slug, saved), values ?? {}));
}
