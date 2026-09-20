/**
 * Pure helpers for turning Drive content into ContentPage rows and media files.
 * No network or database access here — everything is unit-testable.
 */
import sanitizeHtml from "sanitize-html";
import type { ContentCategory } from "@/lib/data/types";

/* ------------------------------------------------------------------ */
/* Folder layout                                                       */
/* ------------------------------------------------------------------ */

/**
 * Staff-facing layout of the shared "The Box Website" Drive folder.
 * Category is decided by the subfolder a Doc lives in (or by the Content Index sheet).
 */
export const CONTENT_FOLDER = "Content";

export const CONTENT_SUBFOLDER_CATEGORIES: Record<string, ContentCategory> = {
  policies: "policy",
  policy: "policy",
  learning: "lesson",
  lessons: "lesson",
  classes: "class",
  volunteer: "volunteer",
  volunteering: "volunteer",
  faq: "faq",
  hours: "hours",
  waiver: "waiver",
  about: "other",
};

/** Docs sitting directly in Content/ with one of these names get a fixed slug + category. */
export const ROOT_CONTENT_DOCS: Record<
  string,
  { slug: string; category: ContentCategory }
> = {
  waiver: { slug: "waiver", category: "waiver" },
  "liability waiver": { slug: "waiver", category: "waiver" },
  hours: { slug: "hours", category: "hours" },
  "hours of operation": { slug: "hours", category: "hours" },
  faq: { slug: "faq", category: "faq" },
  history: { slug: "history", category: "other" },
  staff: { slug: "staff", category: "other" },
};

export interface MediaTarget {
  /** Drive path under the root folder. */
  drivePath: string;
  /** Local directory under the repo's public/ folder. */
  publicDir: string;
  /** Human label for logs / README. */
  label: string;
}

export const MEDIA_TARGETS: MediaTarget[] = [
  { drivePath: "Flyers", publicDir: "uploads/flyers", label: "Event flyers" },
  {
    drivePath: "Photos/Made here",
    publicDir: "images/projects",
    label: "Made-here gallery",
  },
  { drivePath: "Photos/Promos", publicDir: "uploads/promos", label: "Lobby promos" },
];

/* ------------------------------------------------------------------ */
/* Ids, slugs, filenames                                               */
/* ------------------------------------------------------------------ */

/** Accepts a bare id or any Drive/Docs/Sheets URL and returns the file id. */
export function extractDriveId(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // Drive ids are long opaque tokens (19+ chars in practice); anything shorter is not one.
  const patterns = [
    /\/(?:d|folders)\/([A-Za-z0-9_-]{19,})/,
    /[?&]id=([A-Za-z0-9_-]{19,})/,
  ];
  for (const re of patterns) {
    const m = v.match(re);
    if (m) return m[1];
  }
  return /^[A-Za-z0-9_-]{19,}$/.test(v) ? v : null;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Filesystem-safe name that still reads like the Drive name. */
export function safeFileName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const dot = trimmed.lastIndexOf(".");
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot + 1).toLowerCase() : "";
  const safeBase = slugify(base) || "file";
  return ext ? `${safeBase}.${ext.replace(/[^a-z0-9]/g, "")}` : safeBase;
}

/** Strip a trailing "(v2)" / "v2026.1" style version hint from a Doc title. */
export function splitTitleVersion(name: string): {
  title: string;
  version: string | null;
} {
  const m = name.match(/^(.*?)\s*[\(\[]?\s*v(?:ersion)?\s*[.:]?\s*([0-9][0-9.]*)\s*[\)\]]?\s*$/i);
  if (!m) return { title: name.trim(), version: null };
  return { title: m[1].trim(), version: m[2] };
}

/* ------------------------------------------------------------------ */
/* Category resolution                                                 */
/* ------------------------------------------------------------------ */

export interface ResolvedDoc {
  slug: string;
  title: string;
  category: ContentCategory;
  version: string | null;
}

/**
 * Decide slug/category for a Doc from where it sits under Content/.
 * `folders` are the folder names between Content/ and the Doc (empty for the root).
 *
 *   Content/Waiver                         → waiver / "waiver"
 *   Content/Policies/Member Expectations   → policy / "member-expectations"
 *   Content/Learning/3D Printing/Materials → lesson / "3d-printing-materials"
 */
export function resolveDocFromPath(
  docName: string,
  folders: string[] = [],
): ResolvedDoc {
  const { title, version } = splitTitleVersion(docName);
  const key = title.toLowerCase();
  const top = folders[0]?.trim().toLowerCase() ?? null;

  if (!top && ROOT_CONTENT_DOCS[key]) {
    return { ...ROOT_CONTENT_DOCS[key], title, version };
  }

  const category: ContentCategory = top
    ? (CONTENT_SUBFOLDER_CATEGORIES[top] ?? "other")
    : "policy";

  const slug = slugify([...folders.slice(1), title].join(" "));
  return { slug, title, category, version };
}

/* ------------------------------------------------------------------ */
/* Content Index sheet (optional)                                      */
/* ------------------------------------------------------------------ */

export interface ContentIndexRow {
  slug: string;
  title: string | null;
  category: ContentCategory | null;
  fileId: string;
  published: boolean;
  version: string | null;
}

const CATEGORY_VALUES: ContentCategory[] = [
  "policy",
  "waiver",
  "lesson",
  "class",
  "volunteer",
  "hours",
  "faq",
  "other",
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Columns (header row, any order, case-insensitive):
 *   slug | title | category | doc (id or URL) | published (yes/no/true/false) | version
 */
export function parseContentIndexCsv(text: string): ContentIndexRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) =>
    header.findIndex((h) => names.includes(h));
  const iSlug = col("slug");
  const iTitle = col("title", "name");
  const iCat = col("category", "type");
  const iDoc = col("doc", "doc id", "doc_id", "doc_id_or_url", "document", "url", "link", "file");
  const iPub = col("published", "live", "publish");
  const iVer = col("version");

  const out: ContentIndexRow[] = [];
  for (const r of rows.slice(1)) {
    const docRaw = iDoc >= 0 ? r[iDoc] ?? "" : "";
    const fileId = extractDriveId(docRaw);
    if (!fileId) continue;
    const rawSlug = iSlug >= 0 ? (r[iSlug] ?? "").trim() : "";
    const title = iTitle >= 0 ? (r[iTitle] ?? "").trim() || null : null;
    const slug = slugify(rawSlug || title || "");
    if (!slug) continue;
    const catRaw = iCat >= 0 ? (r[iCat] ?? "").trim().toLowerCase() : "";
    const category = CATEGORY_VALUES.includes(catRaw as ContentCategory)
      ? (catRaw as ContentCategory)
      : (CONTENT_SUBFOLDER_CATEGORIES[catRaw] ?? null);
    const pubRaw = iPub >= 0 ? (r[iPub] ?? "").trim().toLowerCase() : "";
    const published = !["no", "false", "0", "draft", "off"].includes(pubRaw);
    const version = iVer >= 0 ? (r[iVer] ?? "").trim() || null : null;
    out.push({ slug, title, category, fileId, published, version });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Google Docs HTML → clean ContentPage HTML                           */
/* ------------------------------------------------------------------ */

interface ClassStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

/** Google Docs exports formatting as CSS classes in <head>; read the ones we care about. */
function parseGoogleClassStyles(html: string): Map<string, ClassStyle> {
  const styles = new Map<string, ClassStyle>();
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    const ruleRe = /\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(block))) {
      const [, cls, body] = m;
      const prev = styles.get(cls) ?? {
        bold: false,
        italic: false,
        underline: false,
        strike: false,
      };
      const weight = body.match(/font-weight\s*:\s*([0-9]+|bold)/i)?.[1];
      styles.set(cls, {
        bold:
          prev.bold ||
          (weight !== undefined && (weight === "bold" || Number(weight) >= 600)),
        italic: prev.italic || /font-style\s*:\s*italic/i.test(body),
        underline:
          prev.underline || /text-decoration\s*:\s*[^;]*underline/i.test(body),
        strike:
          prev.strike || /text-decoration\s*:\s*[^;]*line-through/i.test(body),
      });
    }
  }
  return styles;
}

function unwrapGoogleRedirect(href: string): string {
  try {
    const url = new URL(href);
    if (url.hostname === "www.google.com" && url.pathname === "/url") {
      const q = url.searchParams.get("q");
      if (q) return q;
    }
  } catch {
    /* relative or malformed — leave as is */
  }
  return href;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export const CONTENT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, href: unwrapGoogleRedirect(attribs.href ?? "") },
    }),
  },
};

/**
 * Convert the HTML that Drive exports for a Google Doc into the small,
 * predictable subset ContentPage stores (same allowlist as the Notion sync).
 * Bold/italic/underline carried via Google's generated classes become
 * <strong>/<em>/<u>; spans, classes, inline styles and empty paragraphs go away.
 */
export function googleDocHtmlToContentHtml(exportHtml: string): string {
  const classStyles = parseGoogleClassStyles(exportHtml);
  const bodyMatch = exportHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : exportHtml;

  // Google puts the document title/subtitle in <p class="title"> / <p class="subtitle">.
  html = html
    .replace(
      /<p[^>]*class="[^"]*\bsubtitle\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      "<h2>$1</h2>",
    )
    .replace(
      /<p[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      "<h1>$1</h1>",
    );

  // Spans → semantic inline tags based on the class styles.
  html = html.replace(
    /<span([^>]*)>([\s\S]*?)<\/span>/gi,
    (_m, attrs: string, inner: string) => {
      const classes = attrs.match(/class="([^"]*)"/i)?.[1]?.split(/\s+/) ?? [];
      let out = inner;
      let bold = false;
      let italic = false;
      let underline = false;
      let strike = false;
      for (const cls of classes) {
        const s = classStyles.get(cls);
        if (!s) continue;
        bold ||= s.bold;
        italic ||= s.italic;
        underline ||= s.underline;
        strike ||= s.strike;
      }
      if (!out.trim()) return out;
      if (strike) out = `<s>${out}</s>`;
      if (underline) out = `<u>${out}</u>`;
      if (italic) out = `<em>${out}</em>`;
      if (bold) out = `<strong>${out}</strong>`;
      return out;
    },
  );

  // Docs exports images as absolute URLs; keep them but drop sizing attributes.
  html = html.replace(/<img([^>]*)>/gi, (_m, attrs: string) => {
    const src = attrs.match(/src="([^"]*)"/i)?.[1] ?? "";
    const alt = attrs.match(/alt="([^"]*)"/i)?.[1] ?? "";
    return src ? `<img src="${src}" alt="${alt}">` : "";
  });

  let clean = sanitizeHtml(html, CONTENT_SANITIZE_OPTIONS);

  // Underlined links are Google's default; the site styles links itself.
  clean = clean.replace(/<a([^>]*)><u>([\s\S]*?)<\/u><\/a>/gi, "<a$1>$2</a>");
  // Headings that are entirely bold are just headings.
  clean = clean.replace(
    /<(h[1-6])>\s*<strong>([\s\S]*?)<\/strong>\s*<\/\1>/gi,
    "<$1>$2</$1>",
  );
  // Drop empty paragraphs / headings and collapse whitespace between blocks.
  clean = clean
    .replace(/<(p|h[1-6]|li)>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/>\s+</g, ">\n<")
    .trim();

  return clean;
}

/** Plain text for search/preview — strips tags and decodes common entities. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Media manifests                                                     */
/* ------------------------------------------------------------------ */

export interface MediaManifestEntry {
  /** Public URL path, e.g. /uploads/flyers/boo-in-burien.pdf */
  url: string;
  fileName: string;
  driveFileId: string;
  driveName: string;
  mimeType: string;
  modifiedTime: string | null;
  md5: string | null;
  size: number | null;
  /** Drive "Details → Description" — handy for captions/alt text. */
  description: string | null;
}

export interface MediaManifest {
  source: string;
  syncedAt: string;
  files: MediaManifestEntry[];
}

export const MANIFEST_FILE = "drive-manifest.json";

/** Google-native files in media folders export to these types. */
export function exportMimeForMedia(mimeType: string): {
  mime: string;
  ext: string;
} | null {
  switch (mimeType) {
    case "application/vnd.google-apps.document":
    case "application/vnd.google-apps.presentation":
    case "application/vnd.google-apps.drawing":
      return { mime: "application/pdf", ext: "pdf" };
    default:
      return null;
  }
}

export function isSupportedMedia(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    exportMimeForMedia(mimeType) !== null
  );
}
