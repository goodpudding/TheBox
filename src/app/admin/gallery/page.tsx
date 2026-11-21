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
import { compressInventoryPhoto } from "@/lib/inventory/compress-client";
import { PHOTO_UPLOAD_FAILED } from "@/lib/inventory/config";
import { readJson } from "@/lib/read-json";
import type { Project } from "@/lib/data";

type Draft = {
  id?: string;
  title: string;
  maker: string;
  area: string;
  caption: string;
  imageSrc: string;
  imageAlt: string;
  published: boolean;
};

const blank = (): Draft => ({
  title: "",
  maker: "",
  area: "",
  caption: "",
  imageSrc: "",
  imageAlt: "",
  published: true,
});

export default function AdminGalleryPage() {
  const { provider, revision, bump } = useData();
  const [projects, setProjects] = useState<Project[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.adminListProjects().then((list) => {
      if (!cancelled) setProjects(list);
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

  async function onPicture(file: File) {
    setUploading(true);
    setError(null);
    try {
      // Shrunk in the browser first, like inventory photos.
      const compressed = await compressInventoryPhoto(file);
      const body = new FormData();
      body.set("file", compressed.full, "project.jpg");
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const data = await readJson<{ url?: string; error?: string }>(res);
      if (!res.ok || !data?.url) throw new Error(data?.error ?? PHOTO_UPLOAD_FAILED);
      const url = data.url;
      setDraft((d) => (d ? { ...d, imageSrc: url } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : PHOTO_UPLOAD_FAILED);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    try {
      const saved = await provider.adminSaveProject({
        id: draft.id,
        title: draft.title,
        maker: draft.maker,
        area: draft.area,
        caption: draft.caption,
        imageSrc: draft.imageSrc,
        imageAlt: draft.imageAlt,
        published: draft.published,
      });
      setMessage(`Saved “${saved.title}”.`);
      setDraft(null);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(project: Project) {
    if (!window.confirm(`Remove “${project.title}” from the gallery?`)) return;
    setError(null);
    try {
      await provider.adminDeleteProject(project.id);
      setMessage(`Removed “${project.title}”.`);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    }
  }

  return (
    <AdminShell
      title="Gallery"
      description="The “Made at the makerspace” pictures on the public Made here page. Only post member work with their permission."
    >
      <AdminNotice message={message} error={error} />

      {draft ? (
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-5">
          <h2 className="font-display text-xl font-semibold text-brown">
            {draft.id ? "Edit project" : "Add a project"}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="project-picture">Picture</Label>
            {draft.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.imageSrc}
                alt=""
                className="aspect-[4/3] w-full max-w-sm rounded-2xl object-cover"
              />
            ) : null}
            <input
              id="project-picture"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPicture(file);
              }}
              className="block w-full text-sm text-charcoal"
            />
            {uploading ? <p className="text-sm text-secondary">Uploading…</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-title">Title</Label>
            <Input
              id="project-title"
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-maker">Made by</Label>
              <Input
                id="project-maker"
                value={draft.maker}
                placeholder="First name is enough"
                onChange={(e) => setDraft({ ...draft, maker: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-area">Made with</Label>
              <Input
                id="project-area"
                value={draft.area}
                placeholder="Laser, woodshop…"
                onChange={(e) => setDraft({ ...draft, area: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-caption">Caption</Label>
            <Textarea
              id="project-caption"
              rows={3}
              value={draft.caption}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-alt">
              Describe the picture (for screen readers)
            </Label>
            <Input
              id="project-alt"
              value={draft.imageAlt}
              placeholder="Uses the title when left blank"
              onChange={(e) => setDraft({ ...draft, imageAlt: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Show in the gallery
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending || uploading}>
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
            Add a project
          </Button>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageSrc}
                    alt=""
                    className="size-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-brown">
                      {p.title}{" "}
                      {p.published ? null : <StatusPill tone="muted">Hidden</StatusPill>}
                    </p>
                    <p className="text-sm text-secondary">
                      {[p.maker, p.area].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Edit ${p.title}`}
                    onClick={() =>
                      open({
                        id: p.id,
                        title: p.title,
                        maker: p.maker,
                        area: p.area,
                        caption: p.caption,
                        imageSrc: p.imageSrc,
                        imageAlt: p.imageAlt,
                        published: p.published,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove ${p.title}`}
                    onClick={() => void onDelete(p)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {projects.length === 0 ? (
            <p className="mt-6 text-secondary">The gallery is empty.</p>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
