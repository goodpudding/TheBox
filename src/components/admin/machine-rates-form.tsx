"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_RATE_CARD,
  RATE_CARD_RULES,
  applyRateCardPatch,
  type RateCard,
} from "@/lib/rate-card";
import { rateCardExamples } from "@/lib/rate-card-examples";

type NumberField = Exclude<keyof RateCard, "plasmaSetupWaivedLastWeekend">;

/** The form in the order staff think about it. */
const GROUPS: { title: string; fields: NumberField[] }[] = [
  {
    title: "Laser",
    fields: ["laserMemberHourlyCents", "laserNonmemberHourlyCents", "laserMinimumCents"],
  },
  {
    title: "CNC",
    fields: ["cncMemberHourlyCents", "cncNonmemberHourlyCents", "cncMinimumCents"],
  },
  {
    title: "Plasma",
    fields: ["plasmaMemberHourlyCents", "plasmaNonmemberHourlyCents", "plasmaSetupCents"],
  },
  {
    title: "3D printing",
    fields: [
      "filamentCentsPerKg",
      "filamentMarkup",
      "printerMemberMinimumCents",
      "printerNonmemberMinimumCents",
    ],
  },
  {
    title: "Sublimation",
    fields: ["sublimationMemberCents", "sublimationNonmemberCents"],
  },
  { title: "Run time", fields: ["roundUpMinutes"] },
];

type Draft = Record<NumberField, string> & { plasmaSetupWaivedLastWeekend: boolean };

/** Cents are typed as dollars, the markup as a percentage over cost. */
function toText(field: NumberField, value: number): string {
  const rule = RATE_CARD_RULES[field];
  if (rule.kind === "cents") return (value / 100).toFixed(2);
  if (rule.kind === "markup") return String(Math.round((value - 1) * 10000) / 100);
  return String(value);
}

function toNumber(field: NumberField, text: string): number {
  const typed = Number(text.trim().replace(/^\$/, ""));
  if (text.trim() === "" || !Number.isFinite(typed)) return Number.NaN;
  const rule = RATE_CARD_RULES[field];
  if (rule.kind === "cents") return Math.round(typed * 100);
  if (rule.kind === "markup") return Math.round((1 + typed / 100) * 10000) / 10000;
  return typed;
}

function draftFrom(card: RateCard): Draft {
  const draft = { plasmaSetupWaivedLastWeekend: card.plasmaSetupWaivedLastWeekend } as Draft;
  for (const group of GROUPS) {
    for (const field of group.fields) draft[field] = toText(field, card[field]);
  }
  return draft;
}

function patchFrom(draft: Draft): Partial<RateCard> {
  const patch: Partial<RateCard> = {
    plasmaSetupWaivedLastWeekend: draft.plasmaSetupWaivedLastWeekend,
  };
  for (const group of GROUPS) {
    for (const field of group.fields) patch[field] = toNumber(field, draft[field]);
  }
  return patch;
}

function label(field: NumberField): string {
  const rule = RATE_CARD_RULES[field];
  if (rule.kind === "cents") return `${rule.label} ($)`;
  if (rule.kind === "markup") return `${rule.label} (% over cost)`;
  return rule.label;
}

/**
 * The shop's machine prices. What is saved here is what the desks show and
 * what a sent job is charged, from the next job on. Jobs already sent keep
 * what they were charged.
 */
export function MachineRatesForm() {
  const { provider, revision, bump } = useData();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.getRateCard().then((card) => {
      if (!cancelled) setDraft(draftFrom(card));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  /** Examples for what is typed now, or why it cannot be saved. */
  const preview = useMemo(() => {
    if (!draft) return null;
    try {
      return {
        lines: rateCardExamples(applyRateCardPatch(DEFAULT_RATE_CARD, patchFrom(draft))),
        problem: null,
      };
    } catch (err) {
      return { lines: [], problem: err instanceof Error ? err.message : "Check the values." };
    }
  }, [draft]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await provider.adminSaveRateCard(patchFrom(draft));
      setDraft(draftFrom(saved));
      setMessage("Machine rates saved. The next job sent uses them.");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  if (!draft) return null;

  return (
    <section className="mt-16 max-w-xl border-t border-border pt-10">
      <h2 className="font-display text-xl font-semibold text-brown">Machine rates</h2>
      <p className="mt-2 text-sm text-secondary">
        What a sent job costs. The woodshop, hand tools, sewing and the vinyl cutter
        are included with membership and are not on this list.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-8">
        <AdminNotice message={message} error={error} />
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-4">
            <legend className="font-display text-lg font-semibold text-brown">
              {group.title}
            </legend>
            {group.fields.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`rate-${field}`}>{label(field)}</Label>
                <Input
                  id={`rate-${field}`}
                  inputMode="decimal"
                  required
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                />
              </div>
            ))}
            {group.title === "Plasma" ? (
              <label className="flex items-center gap-3 text-charcoal">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={draft.plasmaSetupWaivedLastWeekend}
                  onChange={(e) =>
                    setDraft({ ...draft, plasmaSetupWaivedLastWeekend: e.target.checked })
                  }
                />
                {RATE_CARD_RULES.plasmaSetupWaivedLastWeekend.label}
              </label>
            ) : null}
          </fieldset>
        ))}

        <div
          className="rounded-2xl border border-border bg-surface/60 px-4 py-3"
          aria-live="polite"
        >
          <p className="font-display text-sm font-medium text-brown">
            With these rates
          </p>
          {preview?.problem ? (
            <p className="mt-2 text-sm text-brown">{preview.problem}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-secondary">
              {preview?.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save machine rates"}
        </Button>
      </form>
    </section>
  );
}
