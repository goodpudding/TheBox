"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VolunteerRole } from "@/lib/data";

type Draft = {
  id?: string;
  title: string;
  descriptionHtml: string;
  sortOrder: string;
  active: boolean;
};

/**
 * The roles on the public Volunteer page: add one, rename it, rewrite what
 * it involves, change the order, or switch it off.
 */
export function VolunteerRoleEditor() {
  const { provider, revision, bump } = useData();
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Remounts the text editor when a different role is opened. */
  const [editorKey, setEditorKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      provider.adminListVolunteerRoles(),
      provider.adminListContentMappings(),
    ]).then(([list, pages]) => {
      if (cancelled) return;
      setRoles(list);
      setDescriptions(Object.fromEntries(pages.map((p) => [p.slug, p.html])));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  function open(next: Draft) {
    setDraft(next);
    setEditorKey((k) => k + 1);
    setMessage(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const order = Number(draft.sortOrder);
      const saved = await provider.adminSaveVolunteerRole({
        id: draft.id,
        title: draft.title,
        descriptionHtml: draft.descriptionHtml,
        sortOrder:
          draft.sortOrder.trim() && Number.isFinite(order) ? order : undefined,
        active: draft.active,
      });
      setMessage(`Saved ${saved.title}.`);
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-10">
      <p className="eyebrow">Volunteer page</p>
      <h2 className="mt-2 font-display text-xl font-semibold text-brown">Roles</h2>
      <div className="mt-4">
        <AdminNotice message={message} error={error} />
      </div>

      {draft ? (
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-3xl space-y-5">
          <h3 className="font-display text-lg font-semibold text-brown">
            {draft.id ? "Edit role" : "Add a role"}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="role-title">Title</Label>
            <Input
              id="role-title"
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <p id="role-description-label" className="font-display text-sm font-medium text-brown">
              What the role involves
            </p>
            <RichTextEditor
              key={editorKey}
              initialHtml={draft.descriptionHtml}
              labelledBy="role-description-label"
              onChange={(html) =>
                setDraft((d) => (d ? { ...d, descriptionHtml: html } : d))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-order">Order (optional)</Label>
            <Input
              id="role-order"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
              aria-describedby="role-order-help"
            />
            <p id="role-order-help" className="text-sm text-secondary">
              Lower numbers come first. Leave blank to add at the end.
            </p>
          </div>
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Show on the Volunteer page
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save role"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Button
            type="button"
            onClick={() =>
              open({ title: "", descriptionHtml: "", sortOrder: "", active: true })
            }
          >
            Add a role
          </Button>
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {roles.map((role) => (
              <li
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <p className="font-display font-semibold text-brown">
                  {role.title}{" "}
                  {role.active ? null : <StatusPill tone="muted">Hidden</StatusPill>}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Edit ${role.title}`}
                  onClick={() =>
                    open({
                      id: role.id,
                      title: role.title,
                      descriptionHtml: descriptions[role.contentSlug] ?? "",
                      sortOrder: String(role.sortOrder),
                      active: role.active,
                    })
                  }
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
          {roles.length === 0 ? (
            <p className="mt-4 text-secondary">No roles yet.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
