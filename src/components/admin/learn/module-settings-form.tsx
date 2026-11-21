"use client";

import { useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describePublishBlockers } from "@/lib/data/learning";
import type {
  Certification,
  LearningModule,
  ModulePublishReadiness,
} from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * The facts about a module that staff set once and then adjust: its title
 * and summary, which certification it leads to, the pass mark, how many
 * tries a member gets, and whether the shop has the equipment it teaches.
 * Publishing stays on the Publish button; this form says what still blocks it.
 */
export function ModuleSettingsForm({
  module,
  certifications,
  readiness,
  onSaved,
}: {
  module: LearningModule;
  certifications: Certification[];
  readiness: ModulePublishReadiness | null;
  onSaved: () => void;
}) {
  const { provider } = useData();
  const [title, setTitle] = useState(module.title);
  const [summary, setSummary] = useState(module.summary);
  const [certificationId, setCertificationId] = useState(module.certificationId);
  const [knowledgeOnly, setKnowledgeOnly] = useState(module.knowledgeOnly);
  const [passMark, setPassMark] = useState(String(module.passThresholdPercent));
  const [attempts, setAttempts] = useState(String(module.attemptLimit));
  const [order, setOrder] = useState(String(module.sortOrder));
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(
    module.equipmentStatus === "confirmed",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blockers = readiness ? describePublishBlockers(readiness) : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await provider.adminUpsertModule({
        id: module.id,
        slug: module.slug,
        title,
        summary,
        certificationId,
        knowledgeOnly,
        passThresholdPercent: Number(passMark),
        attemptLimit: Number(attempts),
        sortOrder: Number(order),
        equipmentStatus: equipmentConfirmed ? "confirmed" : "unconfirmed",
      });
      setMessage("Module details saved.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the module.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      aria-labelledby="module-details-heading"
      className="max-w-xl space-y-5 rounded-2xl border border-border bg-surface/60 p-5"
    >
      <h2
        id="module-details-heading"
        className="font-display text-xl font-semibold text-brown"
      >
        Module details
      </h2>
      <AdminNotice message={message} error={error} />

      <div className="space-y-2">
        <Label htmlFor="module-title">Title</Label>
        <Input
          id="module-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="module-summary">Summary</Label>
        <Textarea
          id="module-summary"
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          aria-describedby="module-summary-help"
        />
        <p id="module-summary-help" className="text-sm text-secondary">
          One or two sentences members see under the title.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="module-cert">Certification it leads to</Label>
        <select
          id="module-cert"
          value={certificationId}
          onChange={(e) => setCertificationId(e.target.value)}
          className={selectClass}
        >
          {certifications.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active ? "" : " (switched off)"}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-3 text-charcoal">
        <input
          type="checkbox"
          className="size-5"
          checked={knowledgeOnly}
          onChange={(e) => setKnowledgeOnly(e.target.checked)}
        />
        Passing the quiz is enough (no hands-on checkoff)
      </label>
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="module-pass">Pass mark (%)</Label>
          <Input
            id="module-pass"
            inputMode="numeric"
            required
            value={passMark}
            onChange={(e) => setPassMark(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="module-attempts">Quiz attempts</Label>
          <Input
            id="module-attempts"
            inputMode="numeric"
            required
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="module-order">Order in the list</Label>
          <Input
            id="module-order"
            inputMode="numeric"
            required
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="flex items-center gap-3 text-charcoal">
          <input
            type="checkbox"
            className="size-5"
            checked={equipmentConfirmed}
            onChange={(e) => setEquipmentConfirmed(e.target.checked)}
            aria-describedby="module-equipment-help"
          />
          The equipment on the floor matches this module
        </label>
        <p id="module-equipment-help" className="mt-2 text-sm text-secondary">
          Untick while the shop is still waiting on the machine this module
          teaches, or the model is not settled. A module cannot be published
          until this is ticked.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-page px-4 py-3 text-sm text-charcoal">
        {blockers.length === 0 ? (
          <p>Nothing is blocking this module from being published.</p>
        ) : (
          <>
            <p className="font-display font-semibold text-brown">
              Before this can be published
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save module details"}
      </Button>
    </form>
  );
}
