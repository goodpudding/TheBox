"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminNotice } from "@/components/admin/admin-notice";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Person, PersonKind } from "@/lib/data";

type Draft = {
  id?: string;
  name: string;
  roleTitle: string;
  kind: PersonKind;
  bio: string;
  sortOrder: string;
  published: boolean;
};

const blank = (): Draft => ({
  name: "",
  roleTitle: "",
  kind: "staff",
  bio: "",
  sortOrder: "",
  published: true,
});

export default function AdminPeoplePage() {
  const { provider, revision, bump } = useData();
  const [people, setPeople] = useState<Person[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.adminListPeople().then((list) => {
      if (!cancelled) setPeople(list);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  function open(next: Draft) {
    setDraft(next);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    try {
      const order = Number(draft.sortOrder);
      const saved = await provider.adminSavePerson({
        id: draft.id,
        name: draft.name,
        roleTitle: draft.roleTitle,
        kind: draft.kind,
        bio: draft.bio,
        sortOrder:
          draft.sortOrder.trim() && Number.isFinite(order) ? order : undefined,
        published: draft.published,
      });
      setMessage(`Saved ${saved.name}.`);
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(person: Person) {
    if (!window.confirm(`Remove ${person.name} from the Staff page?`)) return;
    setError(null);
    try {
      await provider.adminDeletePerson(person.id);
      setMessage(`Removed ${person.name}.`);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    }
  }

  return (
    <AdminShell
      title="People"
      description="Who appears on the public Staff page: staff first, then instructors."
    >
      <AdminNotice message={message} error={error} />

      {draft ? (
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-5">
          <h2 className="font-display text-xl font-semibold text-brown">
            {draft.id ? "Edit person" : "Add a person"}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="person-name">Name</Label>
            <Input
              id="person-name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-role">Role or title</Label>
            <Input
              id="person-role"
              value={draft.roleTitle}
              placeholder="Makerspace Manager"
              onChange={(e) => setDraft({ ...draft, roleTitle: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-kind">Listed under</Label>
            <select
              id="person-kind"
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as PersonKind })
              }
              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal"
            >
              <option value="staff">Staff</option>
              <option value="instructor">Instructors</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-bio">Bio</Label>
            <Textarea
              id="person-bio"
              rows={5}
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-order">Order (optional)</Label>
            <Input
              id="person-order"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
              aria-describedby="person-order-help"
            />
            <p id="person-order-help" className="text-sm text-secondary">
              Lower numbers come first. Leave blank to add at the end.
            </p>
          </div>
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Show on the Staff page
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Button type="button" onClick={() => open(blank())}>
            Add a person
          </Button>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-display font-semibold text-brown">
                    {p.name}{" "}
                    {p.published ? null : <StatusPill tone="muted">Hidden</StatusPill>}
                  </p>
                  <p className="text-sm text-secondary">
                    {p.kind === "staff" ? "Staff" : "Instructor"}
                    {p.roleTitle ? ` · ${p.roleTitle}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Edit ${p.name}`}
                    onClick={() =>
                      open({
                        id: p.id,
                        name: p.name,
                        roleTitle: p.roleTitle,
                        kind: p.kind,
                        bio: p.bio,
                        sortOrder: String(p.sortOrder),
                        published: p.published,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => void onDelete(p)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {people.length === 0 ? (
            <p className="mt-6 text-secondary">Nobody is listed yet.</p>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
