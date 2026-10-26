"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MemberGate } from "@/components/member-gate";
import { PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { InventoryPhoto } from "@/components/inventory-photo";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useData } from "@/components/providers";
import {
  canInventory,
  conditionLabel,
  EVENT_LABELS,
  PHOTO_KIND_LABELS,
  STATUS_LABELS,
} from "@/lib/inventory";
import { compressInventoryPhoto } from "@/lib/inventory/compress-client";
import { formatDateTime } from "@/lib/format";
import type {
  AreaSteward,
  InventoryArea,
  InventoryItemDetail,
  InventoryIssueType,
  ItemStatus,
  PhotoKind,
} from "@/lib/data";

export default function InventoryItemPage() {
  return (
    <MemberGate>
      <ItemBody />
    </MemberGate>
  );
}

function ItemBody() {
  const params = useParams<{ assetTag: string }>();
  const assetTag = typeof params.assetTag === "string" ? params.assetTag : "";
  const { provider, currentUser, revision, bump } = useData();
  const [item, setItem] = useState<InventoryItemDetail | null | undefined>(
    undefined,
  );
  const [areas, setAreas] = useState<InventoryArea[]>([]);
  const [stewards, setStewards] = useState<AreaSteward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  useEffect(() => {
    if (!currentUser || !assetTag) return;
    let cancelled = false;
    void Promise.all([
      provider.getInventoryItem(currentUser.id, assetTag),
      provider.listInventoryAreas(),
      provider.listAreaStewards(),
    ]).then(([found, areaList, stewardList]) => {
      if (cancelled) return;
      setItem(found);
      setAreas(areaList);
      setStewards(stewardList);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, currentUser, revision, assetTag]);

  if (item === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }
  if (!item || !currentUser) {
    return (
      <PageShell>
        <p className="eyebrow">Inventory</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-brown">
          Item not found
        </h1>
        <Button asChild className="mt-6" variant="secondary">
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </PageShell>
    );
  }

  const opts = { areaId: item.areaId, stewards };
  const canEdit = canInventory(currentUser, "edit", opts);
  const canStatus = canInventory(currentUser, "changeStatus", opts);
  const canMove = canInventory(currentUser, "move", opts);
  const canRetire = canInventory(currentUser, "retire", opts);
  const canPhoto = canInventory(currentUser, "addPhoto", opts);
  const canIssue = canInventory(currentUser, "reportIssue");
  const canApprove =
    item.reviewStatus === "PENDING" &&
    canInventory(currentUser, "approve", opts);

  return (
    <PageShell>
      <InventorySubnav />
      {error ? (
        <p className="mb-4 rounded-xl bg-accent/15 px-4 py-3 text-sm text-brown">
          {error}
        </p>
      ) : null}
      <p className="eyebrow">{item.assetTag}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-brown">
          {item.name}
        </h1>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            tone={
              item.reviewStatus === "APPROVED"
                ? "ok"
                : item.reviewStatus === "PENDING"
                  ? "warn"
                  : "danger"
            }
          >
            {item.reviewStatus}
          </StatusPill>
          <StatusPill>{STATUS_LABELS[item.status]}</StatusPill>
          <StatusPill>{conditionLabel(item.condition)}</StatusPill>
        </div>
      </div>
      <p className="mt-2 text-secondary">
        {[item.manufacturer, item.model, item.areaName ?? "Area not sure"]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {item.photos.map((photo) => (
          <figure key={photo.id} className="overflow-hidden rounded-2xl bg-surface">
            <InventoryPhoto
              storageKey={photo.storageKey}
              alt={PHOTO_KIND_LABELS[photo.kind]}
              className="h-56 w-full"
            />
            <figcaption className="px-3 py-2 font-display text-xs uppercase tracking-wider text-secondary">
              {PHOTO_KIND_LABELS[photo.kind]}
            </figcaption>
          </figure>
        ))}
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <Info label="Location" value={item.location ?? "—"} />
        <Info label="Serial" value={item.noSerial ? "None" : item.serialNumber ?? "—"} />
        <Info label="Quantity" value={String(item.quantity)} />
        <Info label="Submitted by" value={item.createdByName ?? "—"} />
        {item.notes ? <Info label="Notes" value={item.notes} /> : null}
        {item.retiredReason ? (
          <Info label="Retired" value={item.retiredReason} />
        ) : null}
        {item.rejectReason ? (
          <Info label="Reject reason" value={item.rejectReason} />
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-2">
        {canEdit ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
            Edit
          </Button>
        ) : null}
        {canApprove ? (
          <Button
            size="sm"
            onClick={() =>
              void provider
                .reviewInventoryItem(currentUser.id, item.id, "approve")
                .then(bump)
                .catch((err: Error) => setError(err.message))
            }
          >
            Approve
          </Button>
        ) : null}
        {canPhoto ? <AddPhotoButton itemId={item.id} onDone={bump} onError={setError} /> : null}
        {canIssue ? (
          <Button size="sm" variant="outline" onClick={() => setIssueOpen((v) => !v)}>
            Report issue
          </Button>
        ) : null}
      </div>

      {editing && canEdit ? (
        <EditForm
          item={item}
          areas={areas}
          onSave={async (patch) => {
            await provider.updateInventoryItem(currentUser.id, item.id, patch);
            setEditing(false);
            bump();
          }}
          onError={setError}
        />
      ) : null}

      {canStatus || canMove || canRetire ? (
        <StaffActions
          item={item}
          canStatus={canStatus}
          canMove={canMove}
          canRetire={canRetire}
          onAction={async (fn) => {
            try {
              await fn();
              bump();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Action failed");
            }
          }}
          userId={currentUser.id}
        />
      ) : null}

      {issueOpen ? (
        <IssueForm
          onSubmit={async (input) => {
            await provider.reportInventoryIssue(currentUser.id, item.id, input);
            setIssueOpen(false);
            bump();
          }}
          onError={setError}
        />
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-brown">History</h2>
        <ol className="mt-4 space-y-3">
          {item.events.map((event) => (
            <li key={event.id} className="border-l-2 border-primary/40 pl-4">
              <p className="font-display text-sm font-semibold text-brown">
                {EVENT_LABELS[event.type]}
              </p>
              <p className="text-sm text-secondary">
                {event.actorName ?? "Someone"} · {formatDateTime(event.createdAt)}
              </p>
              {event.note ? (
                <p className="mt-1 text-sm text-charcoal">{event.note}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-display text-xs uppercase tracking-wider text-secondary">
        {label}
      </dt>
      <dd className="mt-1 text-charcoal">{value}</dd>
    </div>
  );
}

function EditForm({
  item,
  areas,
  onSave,
  onError,
}: {
  item: InventoryItemDetail;
  areas: InventoryArea[];
  onSave: (patch: {
    name: string;
    model: string | null;
    manufacturer: string | null;
    location: string | null;
    notes: string | null;
    areaId: string | null;
    condition: InventoryItemDetail["condition"];
  }) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [model, setModel] = useState(item.model ?? "");
  const [manufacturer, setManufacturer] = useState(item.manufacturer ?? "");
  const [location, setLocation] = useState(item.location ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [areaId, setAreaId] = useState(item.areaId ?? "");
  const [condition, setCondition] = useState(item.condition);

  return (
    <form
      className="mt-6 max-w-lg space-y-3 rounded-2xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          name,
          model: model || null,
          manufacturer: manufacturer || null,
          location: location || null,
          notes: notes || null,
          areaId: areaId || null,
          condition,
        }).catch((err: Error) => onError(err.message));
      }}
    >
      <Label htmlFor="edit-name">Name</Label>
      <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
      <Label htmlFor="edit-model">Model</Label>
      <Input id="edit-model" value={model} onChange={(e) => setModel(e.target.value)} />
      <Label htmlFor="edit-mfr">Manufacturer</Label>
      <Input
        id="edit-mfr"
        value={manufacturer}
        onChange={(e) => setManufacturer(e.target.value)}
      />
      <Label htmlFor="edit-area">Area</Label>
      <select
        id="edit-area"
        className="h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm"
        value={areaId}
        onChange={(e) => setAreaId(e.target.value)}
      >
        <option value="">Not sure</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Label htmlFor="edit-cond">Condition</Label>
      <select
        id="edit-cond"
        className="h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm"
        value={condition}
        onChange={(e) =>
          setCondition(e.target.value as InventoryItemDetail["condition"])
        }
      >
        <option value="NEW">New</option>
        <option value="GOOD">Good</option>
        <option value="FAIR">Fair</option>
        <option value="NEEDS_REPAIR">Needs repair</option>
        <option value="BROKEN">Broken</option>
      </select>
      <Label htmlFor="edit-loc">Location</Label>
      <Input
        id="edit-loc"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <Label htmlFor="edit-notes">Notes</Label>
      <Textarea
        id="edit-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button type="submit">Save</Button>
    </form>
  );
}

function StaffActions({
  item,
  canStatus,
  canMove,
  canRetire,
  onAction,
  userId,
}: {
  item: InventoryItemDetail;
  canStatus: boolean;
  canMove: boolean;
  canRetire: boolean;
  userId: string;
  onAction: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const { provider } = useData();
  const [location, setLocation] = useState(item.location ?? "");
  const [retireReason, setRetireReason] = useState("scrapped");

  return (
    <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3">
      {canStatus ? (
        <div>
          <p className="font-display text-sm font-semibold text-brown">Status</p>
          <select
            className="mt-2 h-11 w-full rounded-full border border-border px-4 font-display text-sm"
            defaultValue={item.status}
            onChange={(e) => {
              const status = e.target.value as ItemStatus;
              void onAction(() =>
                provider.changeInventoryStatus(userId, item.id, status),
              );
            }}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {canMove ? (
        <div>
          <p className="font-display text-sm font-semibold text-brown">Move</p>
          <div className="mt-2 flex gap-2">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              onClick={() =>
                void onAction(() =>
                  provider.moveInventoryItem(userId, item.id, location),
                )
              }
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
      {canRetire && item.status !== "RETIRED" ? (
        <div>
          <p className="font-display text-sm font-semibold text-brown">Retire</p>
          <select
            className="mt-2 h-11 w-full rounded-full border border-border px-4 font-display text-sm"
            value={retireReason}
            onChange={(e) => setRetireReason(e.target.value)}
          >
            <option value="sold">Sold</option>
            <option value="scrapped">Scrapped</option>
            <option value="donated">Donated away</option>
            <option value="lost">Lost</option>
          </select>
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            onClick={() =>
              void onAction(() =>
                provider.retireInventoryItem(userId, item.id, retireReason),
              )
            }
          >
            Retire item
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function IssueForm({
  onSubmit,
  onError,
}: {
  onSubmit: (input: {
    type: InventoryIssueType;
    note?: string;
    photoKey?: string;
    photoMimeType?: string;
  }) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [type, setType] = useState<InventoryIssueType>("BROKEN");
  const [note, setNote] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);

  return (
    <form
      className="mt-6 max-w-lg space-y-3 rounded-2xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          type,
          note,
          photoKey: photoKey ?? undefined,
          photoMimeType: photoKey ? "image/jpeg" : undefined,
        }).catch((err: Error) => onError(err.message));
      }}
    >
      <p className="font-display font-semibold text-brown">Report an issue</p>
      <select
        className="h-11 w-full rounded-full border border-border px-4 font-display text-sm"
        value={type}
        onChange={(e) => setType(e.target.value as InventoryIssueType)}
      >
        <option value="BROKEN">Broken</option>
        <option value="NEEDS_REPAIR">Needs repair</option>
        <option value="MISSING_PART">Missing part</option>
        <option value="OTHER">Other</option>
      </select>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void (async () => {
            const compressed = await compressInventoryPhoto(file);
            const form = new FormData();
            form.append("file", compressed.full, "issue.jpg");
            const res = await fetch("/api/inventory/uploads", {
              method: "POST",
              body: form,
            });
            const json = (await res.json()) as { storageKey?: string };
            if (json.storageKey) setPhotoKey(json.storageKey);
          })();
        }}
      />
      <Button type="submit">Submit issue</Button>
    </form>
  );
}

function AddPhotoButton({
  itemId,
  onDone,
  onError,
}: {
  itemId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { provider, currentUser } = useData();
  return (
    <label className="inline-flex">
      <span className="inline-flex h-9 cursor-pointer items-center rounded-full border border-border px-4 font-display text-xs font-semibold">
        Add photo
      </span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file || !currentUser) return;
          void (async () => {
            try {
              const compressed = await compressInventoryPhoto(file);
              const form = new FormData();
              form.append("file", compressed.full, "extra.jpg");
              form.append("thumb", compressed.thumb, "extra-thumb.jpg");
              const res = await fetch("/api/inventory/uploads", {
                method: "POST",
                body: form,
              });
              const json = (await res.json()) as {
                storageKey?: string;
                thumbKey?: string;
                mimeType?: string;
              };
              if (!json.storageKey) throw new Error("Upload failed");
              await provider.addInventoryPhoto(currentUser.id, itemId, {
                storageKey: json.storageKey,
                thumbKey: json.thumbKey,
                kind: "OTHER" as PhotoKind,
                mimeType: json.mimeType ?? "image/jpeg",
              });
              onDone();
            } catch (err) {
              onError(err instanceof Error ? err.message : "Photo failed");
            }
          })();
        }}
      />
    </label>
  );
}
