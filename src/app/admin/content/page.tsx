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

const CATEGORY_LABEL: Record<ContentCategory, string> = {
  waiver: "Waiver",
  hours: "Hours",
  policy: "Policy",
  faq: "FAQ",
  volunteer: "Volunteer role",
  class: "Class description",
  lesson: "Lesson text",
  other: "Site page",
};

const CATEGORY_ORDER: ContentCategory[] = [
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

  const original = draft?.id ? pages.find((p) => p.id === draft.id) : undefined;
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
            {draft.id ? "Edit page" : "New page"}
          </h2>

          <div className="space-y-2">
            <Label htmlFor="content-title">Title</Label>
            <Input
              id="content-title"
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>

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

          {draft.id ? (
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

          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Published (members can read it)
          </label>

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
        </>
      )}
    </AdminShell>
  );
}
