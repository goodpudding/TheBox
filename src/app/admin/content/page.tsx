"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { ContentCategory, ContentPage } from "@/lib/data";
import { TEXT_BLOCKS, type TextBlock } from "@/lib/data/text-blocks";

const CATEGORY_LABEL: Record<ContentCategory, string> = {
  waiver: "Waiver",
  hours: "Hours",
  policy: "Policy",
  faq: "FAQ",
  volunteer: "Volunteer role",
  class: "Class description",
  lesson: "Lesson text",
  block: "Text on pages",
  other: "Site page",
};

/** Page types staff can pick. A block is opened from its own list, never made here. */
const CATEGORY_ORDER: Exclude<ContentCategory, "block">[] = [
  "waiver",
  "hours",
  "policy",
  "faq",
  "other",
  "volunteer",
  "class",
  "lesson",
];

/** Where a member reads this page, when it has an address of its own. */
function publicPath(page: Pick<ContentPage, "slug" | "category">): string | null {
  if (page.category === "policy") return `/policies/${page.slug}`;
  if (page.category === "waiver") return "/onboarding/waiver";
  if (page.category === "hours") return "/join";
  if (page.slug === "history") return "/history";
  if (page.slug === "staff") return "/staff";
  if (page.slug === "support") return "/support";
  return null;
}

type Draft = {
  id?: string;
  title: string;
  html: string;
  slug: string;
  category: ContentCategory;
  version: string;
  published: boolean;
};

function draftFrom(page: ContentPage): Draft {
  return {
    id: page.id,
    title: page.title,
    html: page.html,
    slug: page.slug,
    category: page.category,
    version: page.version,
    published: page.published,
  };
}

function blankDraft(): Draft {
  return {
    title: "",
    html: "",
    slug: "",
    category: "policy",
    version: "1",
    published: true,
  };
}

export default function AdminContentPage() {
  const { provider, revision, bump } = useData();
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Remounts the editor when a different page is opened. */
  const [editorKey, setEditorKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.adminListContentMappings().then((list) => {
      if (!cancelled) setPages(list);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        pages: pages
          .filter((p) => p.category === category)
          .sort((a, b) => a.title.localeCompare(b.title)),
      })).filter((g) => g.pages.length > 0),
    [pages],
  );

  /** What staff saved for each piece of page text, when it is in use. */
  const savedBlocks = useMemo(
    () =>
      new Map(
        pages
          .filter((p) => p.category === "block")
          .map((p) => [p.slug, p] as const),
      ),
    [pages],
  );

  const original = draft?.id ? pages.find((p) => p.id === draft.id) : undefined;
  const isBlock = draft?.category === "block";
  const blockInUse = isBlock && Boolean(original?.published);

  function openBlock(block: TextBlock) {
    const saved = savedBlocks.get(block.slug);
    open({
      id: saved?.id,
      title: block.title,
      // An override that was switched off starts again from the built-in words.
      html: saved?.published ? saved.html : block.html,
      slug: block.slug,
      category: "block",
      version: saved?.version ?? "1",
      published: true,
    });
  }

  async function revertToBuiltIn() {
    if (!draft || !original) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      // Unpublishing is enough: a block with nothing published shows the
      // built-in words. The row stays, so nothing has to be deleted.
      await provider.adminSaveContentPage({
        id: original.id,
        title: original.title,
        html: original.html,
        published: false,
      });
      setMessage(`“${draft.title}” is back to the built-in text.`);
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the page.");
    } finally {
      setPending(false);
    }
  }
  const waiverVersionChanged =
    draft?.category === "waiver" &&
    draft.published &&
    Boolean(original) &&
    draft.version.trim() !== original?.version;

  function open(next: Draft) {
    setDraft(next);
    setEditorKey((k) => k + 1);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await provider.adminSaveContentPage({
        id: draft.id,
        title: draft.title,
        html: draft.html,
        slug: draft.id ? undefined : draft.slug.trim() || undefined,
        category: draft.category,
        version: draft.version,
        published: draft.published,
      });
      setMessage(`Saved “${saved.title}”.`);
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the page.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Content"
      description="The words on the site: waiver, hours, policies, FAQ and the other pages. Edit one here and members see the change straight away."
    >
      {message ? (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3 text-brown"
        >
          {message}
        </p>
      ) : null}

      {draft ? (
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-3xl space-y-5">
          <h2 className="font-display text-xl font-semibold text-brown">
            {isBlock ? draft.title : draft.id ? "Edit page" : "New page"}
          </h2>

          {isBlock ? (
            <p className="text-sm text-secondary">
              {blockInUse
                ? "You have changed this text. The page shows your version."
                : "This is the built-in text. Save to replace it with your own."}{" "}
              A word in {"{curly braces}"} is filled in for you, such as the contact
              email from Settings. Leave those as they are.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content-title">Title</Label>
              <Input
                id="content-title"
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
          )}

          {isBlock ? null : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="content-category">Page type</Label>
              <select
                id="content-category"
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as ContentCategory })
                }
                className="h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <p className="text-sm text-secondary">
                A Policy shows up in the list on the Policies page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-version">Version</Label>
              <Input
                id="content-version"
                value={draft.version}
                onChange={(e) => setDraft({ ...draft, version: e.target.value })}
                aria-describedby="content-version-help"
              />
              <p id="content-version-help" className="text-sm text-secondary">
                Leave it alone for a typo. Change it when the meaning changes.
              </p>
            </div>
          </div>

          )}

          {isBlock ? null : draft.id ? (
            <p className="text-sm text-secondary">
              Address: <span className="font-mono text-charcoal">{draft.slug}</span>. It
              stays the same so links to this page keep working.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content-slug">Address (optional)</Label>
              <Input
                id="content-slug"
                value={draft.slug}
                placeholder="made from the title"
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <p id="content-body-label" className="font-display text-sm font-medium text-brown">
              Text
            </p>
            <RichTextEditor
              key={editorKey}
              initialHtml={draft.html}
              labelledBy="content-body-label"
              onChange={(html) => setDraft((d) => (d ? { ...d, html } : d))}
            />
            <p className="text-sm text-secondary">
              Type here, or paste from a document. Colours and fonts are dropped so the
              page matches the site.
            </p>
          </div>

          {isBlock ? null : (
            <label className="flex items-center gap-3 text-charcoal">
              <input
                type="checkbox"
                className="size-5"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              Published (members can read it)
            </label>
          )}

          {draft.category === "hours" ? (
            <p className="rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm text-brown">
              The weekly hours are not typed here. Set them under Admin →
              Settings → Opening hours, and the Join page, the lobby display
              and reservations all follow. Use this page for anything extra,
              such as holiday closures; it shows under the week on Join.
            </p>
          ) : null}
          {waiverVersionChanged ? (
            <p className="rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
              Saving the waiver as version {draft.version.trim() || "1"} asks every member
              to sign it again before they use the shop.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save page"}
            </Button>
            {blockInUse ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => void revertToBuiltIn()}
              >
                Go back to the built-in text
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Button type="button" onClick={() => open(blankDraft())}>
            New page
          </Button>

          {groups.map((group) => (
            <section key={group.category} className="mt-10">
              <h2 className="font-display text-xl font-semibold text-brown">
                {CATEGORY_LABEL[group.category]}
              </h2>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {group.pages.map((p) => {
                  const path = publicPath(p);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-brown">
                          {p.title}{" "}
                          {p.published ? null : <StatusPill tone="muted">Draft</StatusPill>}
                        </p>
                        <p className="text-sm text-secondary">
                          Version {p.version} · changed {formatDateTime(p.updatedAt)}
                          {path ? (
                            <>
                              {" · "}
                              <Link
                                href={path}
                                className="text-primary-text underline-offset-2 hover:underline"
                              >
                                View
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => open(draftFrom(p))}
                        aria-label={`Edit ${p.title}`}
                      >
                        Edit
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {pages.length === 0 ? (
            <p className="mt-6 text-secondary">No pages yet.</p>
          ) : null}

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-brown">
              {CATEGORY_LABEL.block}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-secondary">
              The explanatory text on the public pages. Each one starts with the
              built-in wording until you change it.
            </p>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {TEXT_BLOCKS.map((block) => {
                const saved = savedBlocks.get(block.slug);
                const inUse = Boolean(saved?.published);
                return (
                  <li
                    key={block.slug}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-brown">
                        {block.title}{" "}
                        {inUse ? null : <StatusPill tone="muted">Built-in text</StatusPill>}
                      </p>
                      {inUse && saved ? (
                        <p className="text-sm text-secondary">
                          Changed {formatDateTime(saved.updatedAt)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openBlock(block)}
                      aria-label={`Edit ${block.title}`}
                    >
                      Edit
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </AdminShell>
  );
}
