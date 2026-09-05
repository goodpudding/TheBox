"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Certification, LearningModuleView } from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AdminLearnPage() {
  const { provider, revision, bump } = useData();
  const [modules, setModules] = useState<LearningModuleView[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [mods, c] = await Promise.all([
        provider.listModules(),
        provider.listCertifications(),
      ]);
      setModules(mods);
      setCerts(c.filter((x) => x.active));
    })();
  }, [provider, revision]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      await provider.adminUpsertModule({
        title: String(form.get("title") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        certificationId: String(form.get("certificationId") ?? ""),
        knowledgeOnly: form.get("knowledgeOnly") === "on",
        published: form.get("publish") === "on",
      });
      bump();
      setMessage("Module created.");
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create module");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Learn modules"
      description="Publish self-study modules, lessons, and quiz questions."
    >
      {error ? (
        <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-brown">
          {message}
        </p>
      ) : null}

      <ul className="divide-y divide-border border-y border-border">
        {modules.map((mod) => (
          <li
            key={mod.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <Link
                href={`/admin/learn/${mod.id}`}
                className="font-display text-lg font-semibold text-brown hover:text-primary-text"
              >
                {mod.title}
              </Link>
              <p className="mt-1 text-sm text-secondary">
                {mod.slug} · {mod.certification.name} · {mod.lessonCount} lessons
              </p>
            </div>
            <StatusPill tone={mod.published ? "ok" : "muted"}>
              {mod.published ? "Published" : "Draft"}
            </StatusPill>
          </li>
        ))}
        {modules.length === 0 ? (
          <li className="py-6 text-secondary">No modules yet.</li>
        ) : null}
      </ul>

      <section className="mt-12 max-w-xl">
        <h2 className="font-display text-xl font-semibold text-brown">
          Quick create
        </h2>
        <form onSubmit={onCreate} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" required placeholder="laser-basics" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="certificationId">Certification</Label>
            <select
              id="certificationId"
              name="certificationId"
              className={selectClass}
              required
              defaultValue={certs[0]?.id ?? ""}
            >
              {certs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 font-display text-sm text-brown">
            <input type="checkbox" name="knowledgeOnly" className="size-4" />
            Knowledge-only (no hands-on checkoff)
          </label>
          <label className="flex items-center gap-2 font-display text-sm text-brown">
            <input type="checkbox" name="publish" className="size-4" defaultChecked />
            Publish now
          </label>
          <Button type="submit" disabled={pending || certs.length === 0}>
            {pending ? "Creating…" : "Create module"}
          </Button>
        </form>
      </section>
    </AdminShell>
  );
}
