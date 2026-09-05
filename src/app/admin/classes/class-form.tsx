"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/format";
import type {
  Certification,
  ClassCategory,
  ClassSession,
  ClassSessionInput,
  User,
} from "@/lib/data";

const CATEGORIES: { value: ClassCategory; label: string }[] = [
  { value: "orientation", label: "Orientation" },
  { value: "certification_checkoff", label: "Certification checkoff" },
  { value: "workshop", label: "Workshop" },
  { value: "open_studio", label: "Open studio" },
];

const selectClassName =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ClassForm({
  initial,
  staff,
  certifications,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ClassSession> | null;
  staff: User[];
  certifications: Certification[];
  submitLabel: string;
  onSubmit: (data: ClassSessionInput) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prereqs, setPrereqs] = useState<string[]>(
    initial?.prerequisiteCertificationIds ?? [],
  );
  const [published, setPublished] = useState(initial?.published ?? true);

  function togglePrereq(id: string) {
    setPrereqs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const dollars = Number(form.get("priceDollars") ?? 0);
    try {
      await onSubmit({
        id: initial?.id,
        title: String(form.get("title") ?? "").trim(),
        category: String(form.get("category") ?? "workshop") as ClassCategory,
        instructorId: String(form.get("instructorId") ?? ""),
        startsAt: fromDatetimeLocalValue(String(form.get("startsAt") ?? "")),
        endsAt: fromDatetimeLocalValue(String(form.get("endsAt") ?? "")),
        capacity: Number(form.get("capacity") ?? 0),
        priceCents: Math.round(dollars * 100),
        zeffyUrl: String(form.get("zeffyUrl") ?? "").trim() || null,
        location: String(form.get("location") ?? "").trim() || "The Box",
        prerequisiteCertificationIds: prereqs,
        published,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save class");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={initial?.title ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          className={selectClassName}
          defaultValue={initial?.category ?? "workshop"}
          required
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructorId">Instructor</Label>
        <select
          id="instructorId"
          name="instructorId"
          className={selectClassName}
          defaultValue={initial?.instructorId ?? staff[0]?.id ?? ""}
          required
        >
          {staff.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.role})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={
              initial?.startsAt ? toDatetimeLocalValue(initial.startsAt) : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Ends</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={
              initial?.endsAt ? toDatetimeLocalValue(initial.endsAt) : ""
            }
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            required
            defaultValue={initial?.capacity ?? 8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceDollars">Price (USD)</Label>
          <Input
            id="priceDollars"
            name="priceDollars"
            type="number"
            min={0}
            step={1}
            defaultValue={
              initial?.priceCents != null
                ? (initial.priceCents / 100).toFixed(0)
                : "0"
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zeffyUrl">Zeffy URL</Label>
        <Input
          id="zeffyUrl"
          name="zeffyUrl"
          type="url"
          placeholder="https://www.zeffy.com/..."
          defaultValue={initial?.zeffyUrl ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          defaultValue={initial?.location ?? "The Box"}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm font-medium text-brown">
          Prerequisites
        </legend>
        <div className="space-y-2 rounded-2xl border border-border bg-surface/60 px-4 py-3">
          {certifications.length === 0 ? (
            <p className="text-sm text-secondary">No certifications loaded.</p>
          ) : (
            certifications.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 text-sm text-charcoal"
              >
                <input
                  type="checkbox"
                  checked={prereqs.includes(c.id)}
                  onChange={() => togglePrereq(c.id)}
                  className="size-4 accent-brown"
                />
                {c.name}
              </label>
            ))
          )}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="size-4 accent-brown"
        />
        Published
      </label>

      {error ? (
        <p className="text-sm text-brown" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || staff.length === 0}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
