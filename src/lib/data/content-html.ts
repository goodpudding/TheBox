/**
 * What a page of staff-written text may contain. Used when a page is saved
 * from Admin → Content, with the same allowlist as the Drive import, so both
 * routes into ContentPage store the same small set of tags.
 */
import sanitizeHtml from "sanitize-html";
import { CONTENT_SANITIZE_OPTIONS, slugify } from "@/lib/google/content";
import type { ContentCategory } from "./types";

export const CONTENT_CATEGORIES: readonly ContentCategory[] = [
  "policy",
  "waiver",
  "hours",
  "faq",
  "lesson",
  "class",
  "volunteer",
  "other",
];

/** Largest page body kept. The longest real page is a few thousand characters. */
export const MAX_CONTENT_HTML_CHARS = 200_000;

export function cleanContentHtml(html: string): string {
  return sanitizeHtml(html.slice(0, MAX_CONTENT_HTML_CHARS), CONTENT_SANITIZE_OPTIONS).trim();
}

/** True when there is something to read once the tags are gone. */
export function contentHtmlHasText(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "").length > 0;
}

/** The address part of a page: "Parking & Loading" → "parking-loading". */
export function contentSlug(value: string): string {
  return slugify(value.replace(/&/g, " "));
}
