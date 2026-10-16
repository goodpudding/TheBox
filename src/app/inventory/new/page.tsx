"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { InventoryPhoto } from "@/components/inventory-photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useData } from "@/components/providers";
import { compressInventoryPhoto } from "@/lib/inventory/compress-client";
import { CONDITION_CARDS, canInventory } from "@/lib/inventory";
import type {
  InventoryArea,
  InventoryDuplicateHit,
  ItemCondition,
  PhotoKind,
} from "@/lib/data";

const WIZARD_KEY = "thebox.inventory.wizard.v1";
const STEPS = [
  "Front photo",
  "Side photo",
  "Serial photo",
  "Details",
  "Condition",
  "Area",
  "Location",
  "Review",
] as const;

type PhotoDraft = {
  storageKey: string;
  thumbKey?: string | null;
  kind: PhotoKind;
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

type WizardState = {
  step: number;
  photos: Partial<Record<PhotoKind, PhotoDraft>>;
  noSerial: boolean;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  quantity: string;
  condition: ItemCondition | "";
  areaId: string;
  location: string;
  notes: string;
};

const EMPTY: WizardState = {
  step: 0,
  photos: {},
  noSerial: false,
  name: "",
  model: "",
  manufacturer: "",
  serialNumber: "",
  quantity: "1",
  condition: "",
  areaId: "",
  location: "",
  notes: "",
};

function loadWizard(): WizardState {
  try {
    const raw = sessionStorage.getItem(WIZARD_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as WizardState) };
  } catch {
    return EMPTY;
  }
}

function saveWizard(state: WizardState) {
  try {
    sessionStorage.setItem(WIZARD_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export default function InventoryNewPage() {
  return (
    <MemberGate>
      <InventoryWizard />
    </MemberGate>
  );
}

function InventoryWizard() {
  const { provider, currentUser, bump } = useData();
  const [state, setState] = useState<WizardState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [areas, setAreas] = useState<InventoryArea[]>([]);
  const [makers, setMakers] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<InventoryDuplicateHit[]>([]);
  const [doneTag, setDoneTag] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setState(loadWizard());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveWizard(state);
  }, [state, ready]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      provider.listInventoryAreas(),
      provider.listInventoryManufacturers(),
      provider.listInventoryLocations(),
    ]).then(([a, m, loc]) => {
      if (cancelled) return;
      setAreas(a.filter((x) => x.active));
      setMakers(m);
      setLocations(loc);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  async function uploadKind(kind: PhotoKind, file: File) {
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressInventoryPhoto(file);
      const form = new FormData();
      form.append("file", compressed.full, `${kind.toLowerCase()}.jpg`);
      form.append("thumb", compressed.thumb, `${kind.toLowerCase()}-thumb.jpg`);
      form.append("kind", kind);
      const res = await fetch("/api/inventory/uploads", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        storageKey?: string;
        thumbKey?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !json.storageKey) {
        throw new Error(json.error || "Upload failed");
      }
      const draft: PhotoDraft = {
        storageKey: json.storageKey,
        thumbKey: json.thumbKey,
        kind,
        mimeType: json.mimeType ?? "image/jpeg",
        width: compressed.width,
        height: compressed.height,
      };
      setState((s) => ({
        ...s,
        photos: { ...s.photos, [kind]: draft },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function checkSerial(value: string) {
    if (!value.trim()) {
      setDupes([]);
      return;
    }
    const hits = await provider.findInventoryBySerial(value);
    setDupes(hits);
  }

  async function submit(force = false) {
    if (!currentUser) return;
    setSubmitting(true);
    setError(null);
    try {
      const photoKeys = Object.values(state.photos).filter(
        (p): p is PhotoDraft => Boolean(p),
      );
      const created = await provider.createInventoryItem(currentUser.id, {
        name: state.name,
        model: state.model || null,
        manufacturer: state.manufacturer || null,
        serialNumber: state.noSerial ? null : state.serialNumber || null,
        noSerial: state.noSerial,
        quantity: Number(state.quantity) || 1,
        areaId: state.areaId || null,
        location: state.location || null,
        condition: state.condition as ItemCondition,
        notes: state.notes || null,
        photoKeys,
        continueDespiteDuplicate: force,
      });
      try {
        sessionStorage.removeItem(WIZARD_KEY);
      } catch {
        /* ignore */
      }
      setDoneTag(created.assetTag);
      bump();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not submit";
      setError(message);
      if (/already be in inventory/i.test(message)) {
        const serialHits = await provider.findInventoryBySerial(
          state.serialNumber,
        );
        setDupes(serialHits);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canGoNext = useMemo(() => {
    if (state.step === 0) return Boolean(state.photos.FRONT);
    if (state.step === 1) return Boolean(state.photos.SIDE);
    if (state.step === 2) return state.noSerial || Boolean(state.photos.SERIAL);
    if (state.step === 3) return state.name.trim().length > 0;
    if (state.step === 4) return Boolean(state.condition);
    if (state.step === 5) return true;
    if (state.step === 6) return true;
    return true;
  }, [state]);

  if (!ready) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (currentUser && !canInventory(currentUser, "submit")) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Inventory"
          title="Volunteers only"
          description="An active membership with shop access is needed to add items."
        />
      </PageShell>
    );
  }

  if (doneTag) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Inventory"
          title="Item submitted"
          description="It lands in the review queue as pending until a steward or staff approves it."
        />
        <InventorySubnav />
        <p className="font-display text-lg text-brown">Saved as {doneTag}.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setDoneTag(null);
              setState(EMPTY);
              setDupes([]);
            }}
          >
            Add another item
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/inventory/${doneTag}`}>View item</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Inventory"
        title="Add an item"
        description="One hand, rear camera, big buttons. Progress is saved if you refresh."
      />
      <InventorySubnav />

      <div className="mb-6 flex justify-center gap-1.5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={() => i <= state.step && update({ step: i })}
            className={`h-2.5 w-2.5 rounded-full ${
              i === state.step
                ? "bg-button"
                : i < state.step
                  ? "bg-primary"
                  : "bg-border"
            }`}
          />
        ))}
      </div>
      <p className="mb-4 text-center font-display text-sm text-secondary">
        Step {state.step + 1} of {STEPS.length} · {STEPS[state.step]}
      </p>

      {error ? (
        <p className="mb-4 rounded-xl bg-accent/15 px-4 py-3 text-sm text-brown">
          {error}
        </p>
      ) : null}

      {state.step === 0 || state.step === 1 || state.step === 2 ? (
        <PhotoStep
          kind={state.step === 0 ? "FRONT" : state.step === 1 ? "SIDE" : "SERIAL"}
          photo={
            state.photos[
              state.step === 0 ? "FRONT" : state.step === 1 ? "SIDE" : "SERIAL"
            ]
          }
          uploading={uploading}
          onFile={(file) =>
            void uploadKind(
              state.step === 0 ? "FRONT" : state.step === 1 ? "SIDE" : "SERIAL",
              file,
            )
          }
          onSkipSerial={
            state.step === 2
              ? () => update({ noSerial: true, serialNumber: "", step: 3 })
              : undefined
          }
        />
      ) : null}

      {state.step === 3 ? (
        <div className="mx-auto max-w-lg space-y-4">
          <Field label="Item name" htmlFor="inv-name">
            <Input
              id="inv-name"
              value={state.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Orbital sander"
              required
            />
          </Field>
          <Field label="Product / model name" htmlFor="inv-model">
            <Input
              id="inv-model"
              value={state.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="DWE6423"
            />
          </Field>
          <Field label="Manufacturer / brand" htmlFor="inv-mfr">
            <Input
              id="inv-mfr"
              list="inv-makers"
              value={state.manufacturer}
              onChange={(e) => update({ manufacturer: e.target.value })}
              placeholder="DeWalt"
            />
            <datalist id="inv-makers">
              {makers.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          {!state.noSerial ? (
            <Field label="Serial number" htmlFor="inv-serial">
              <Input
                id="inv-serial"
                value={state.serialNumber}
                onChange={(e) => {
                  update({ serialNumber: e.target.value });
                  void checkSerial(e.target.value);
                }}
              />
            </Field>
          ) : (
            <p className="text-sm text-secondary">No serial number.</p>
          )}
          {dupes.length > 0 ? (
            <p className="rounded-xl bg-accent/15 px-4 py-3 text-sm text-brown">
              This might already be in inventory:{" "}
              {dupes.map((d) => (
                <Link
                  key={d.id}
                  href={`/inventory/${d.assetTag}`}
                  className="underline"
                >
                  {d.assetTag} {d.name}
                </Link>
              ))}
              . You can continue anyway.
            </p>
          ) : null}
          <Field label="Quantity" htmlFor="inv-qty">
            <Input
              id="inv-qty"
              type="number"
              min={1}
              value={state.quantity}
              onChange={(e) => update({ quantity: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {state.step === 4 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {CONDITION_CARDS.map((card) => (
            <button
              key={card.value}
              type="button"
              onClick={() => update({ condition: card.value })}
              className={`rounded-2xl border p-5 text-left ${
                state.condition === card.value
                  ? "border-button bg-primary/15"
                  : "border-border bg-surface"
              }`}
            >
              <p className="font-display text-lg font-semibold text-brown">
                {card.label}
              </p>
              <p className="mt-1 text-sm text-secondary">{card.description}</p>
            </button>
          ))}
        </div>
      ) : null}

      {state.step === 5 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => update({ areaId: area.id })}
              className={`rounded-2xl border p-5 text-left font-display text-lg font-semibold ${
                state.areaId === area.id
                  ? "border-button bg-primary/15 text-brown"
                  : "border-border bg-surface text-brown"
              }`}
            >
              {area.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ areaId: "" })}
            className={`rounded-2xl border p-5 text-left font-display text-lg font-semibold ${
              state.areaId === ""
                ? "border-button bg-primary/15 text-brown"
                : "border-border bg-surface text-brown"
            }`}
          >
            Not sure
          </button>
        </div>
      ) : null}

      {state.step === 6 ? (
        <div className="mx-auto max-w-lg space-y-4">
          <Field label="Location" htmlFor="inv-loc">
            <Input
              id="inv-loc"
              list="inv-locs"
              value={state.location}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="Laser room shelf B"
            />
            <datalist id="inv-locs">
              {locations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </Field>
          <Field label="Notes" htmlFor="inv-notes">
            <Textarea
              id="inv-notes"
              value={state.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Missing parts, accessories…"
            />
          </Field>
        </div>
      ) : null}

      {state.step === 7 ? (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex gap-3">
            <InventoryPhoto
              storageKey={state.photos.FRONT?.thumbKey ?? state.photos.FRONT?.storageKey}
              alt=""
              className="h-24 w-24 rounded-xl"
            />
            <div>
              <p className="font-display text-xl font-semibold text-brown">
                {state.name || "Untitled"}
              </p>
              <p className="text-sm text-secondary">
                {[state.manufacturer, state.model].filter(Boolean).join(" · ") ||
                  "No model"}
              </p>
            </div>
          </div>
          <ReviewRow label="Serial" onEdit={() => update({ step: 3 })}>
            {state.noSerial ? "None" : state.serialNumber || "—"}
          </ReviewRow>
          <ReviewRow label="Quantity" onEdit={() => update({ step: 3 })}>
            {state.quantity}
          </ReviewRow>
          <ReviewRow label="Condition" onEdit={() => update({ step: 4 })}>
            {CONDITION_CARDS.find((c) => c.value === state.condition)?.label ?? "—"}
          </ReviewRow>
          <ReviewRow label="Area" onEdit={() => update({ step: 5 })}>
            {areas.find((a) => a.id === state.areaId)?.name ?? "Not sure"}
          </ReviewRow>
          <ReviewRow label="Location" onEdit={() => update({ step: 6 })}>
            {state.location || "—"}
          </ReviewRow>
        </div>
      ) : null}

      <div className="mx-auto mt-8 flex max-w-lg gap-3">
        {state.step > 0 ? (
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => update({ step: state.step - 1 })}
          >
            Back
          </Button>
        ) : null}
        {state.step < 7 ? (
          <Button
            type="button"
            className="flex-1"
            disabled={!canGoNext || uploading}
            onClick={() => update({ step: state.step + 1 })}
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={submitting}
            onClick={() => void submit(dupes.length > 0)}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </PageShell>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ReviewRow({
  label,
  children,
  onEdit,
}: {
  label: string;
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
      <div>
        <p className="font-display text-xs uppercase tracking-wider text-secondary">
          {label}
        </p>
        <p className="mt-1 text-charcoal">{children}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="font-display text-sm font-semibold text-primary-text"
      >
        Edit
      </button>
    </div>
  );
}

function PhotoStep({
  kind,
  photo,
  uploading,
  onFile,
  onSkipSerial,
}: {
  kind: PhotoKind;
  photo?: PhotoDraft;
  uploading: boolean;
  onFile: (file: File) => void;
  onSkipSerial?: () => void;
}) {
  const label =
    kind === "FRONT"
      ? "Front of the item"
      : kind === "SIDE"
        ? "Side profile"
        : "Serial / label";
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {photo ? (
        <InventoryPhoto
          storageKey={photo.thumbKey ?? photo.storageKey}
          alt={label}
          className="h-72 w-full rounded-2xl"
        />
      ) : (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-surface text-secondary">
          {uploading ? "Uploading…" : label}
        </div>
      )}
      <label className="block">
        <span className="sr-only">{label}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <span className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-button font-display text-base font-semibold text-white">
          {photo ? "Retake" : "Take photo"}
        </span>
      </label>
      {onSkipSerial ? (
        <Button type="button" variant="secondary" className="w-full" onClick={onSkipSerial}>
          No serial number
        </Button>
      ) : null}
    </div>
  );
}
