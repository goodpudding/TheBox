"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { TextBlock } from "@/components/text-block";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoneyExact, formatTier } from "@/lib/utils";
import type { CodeOffer, CodeRedemption } from "@/lib/data";

export default function RedeemPage() {
  return (
    <MemberGate>
      <RedeemBody />
    </MemberGate>
  );
}

function months(count: number | undefined): string {
  return `${count ?? 0} month${count === 1 ? "" : "s"}`;
}

/** One sentence saying what the code gives. */
function offerLine(offer: CodeOffer): string {
  if (offer.kind === "credit") {
    return `${formatMoneyExact(offer.amountCents ?? 0)} of shop credit, for machine time and classes.`;
  }
  if (offer.kind === "membership") {
    return `${months(offer.months)} of ${formatTier(offer.tier)} membership, running until ${
      offer.membershipEndsAt ? formatDate(offer.membershipEndsAt) : "the end date"
    }.`;
  }
  return offer.maxPriceCents
    ? `A seat in one class priced up to ${formatMoneyExact(offer.maxPriceCents)}.`
    : "A seat in a class.";
}

function RedeemBody() {
  const { provider, currentUser, bump } = useData();
  const [code, setCode] = useState("");
  const [offer, setOffer] = useState<CodeOffer | null>(null);
  const [classId, setClassId] = useState("");
  const [done, setDone] = useState<CodeRedemption | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) return null;
  const userId = currentUser.id;

  async function onCheck(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOffer(null);
    setDone(null);
    try {
      const next = await provider.getCodeOffer(userId, code);
      setOffer(next);
      setClassId(next.classes?.length === 1 ? next.classes[0]!.id : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check that code.");
    } finally {
      setPending(false);
    }
  }

  async function onRedeem() {
    if (!offer) return;
    setPending(true);
    setError(null);
    try {
      const result = await provider.redeemCode(
        userId,
        code,
        offer.kind === "class" ? { classSessionId: classId } : undefined,
      );
      setDone(result);
      setOffer(null);
      setCode("");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redeem that code.");
    } finally {
      setPending(false);
    }
  }

  const needsClass = offer?.kind === "class";
  const noClasses = needsClass && (offer?.classes?.length ?? 0) === 0;

  return (
    <PageShell>
      <PageHero
        eyebrow="Gift cards and codes"
        title="Redeem a code"
        description={<TextBlock slug="redeem-intro" as="span" />}
      />

      {done ? (
        <div
          role="status"
          className="mt-10 max-w-xl rounded-2xl border border-primary/40 bg-primary/15 px-5 py-4 text-brown"
        >
          <p className="font-display text-lg font-semibold">Redeemed.</p>
          {done.kind === "credit" ? (
            <p className="mt-2">
              {formatMoneyExact(done.amountCents ?? 0)} was added to your shop credit.
              Your balance is {formatMoneyExact(done.balanceCents ?? 0)}.
            </p>
          ) : null}
          {done.kind === "membership" ? (
            <p className="mt-2">
              Your {formatTier(done.tier)} membership runs until{" "}
              {done.membershipEndsAt ? formatDate(done.membershipEndsAt) : "the end date"}.
            </p>
          ) : null}
          {done.kind === "class" ? (
            <p className="mt-2">You have a paid seat in {done.classTitle}.</p>
          ) : null}
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-display text-sm">
            {done.kind === "class" && done.classSessionId ? (
              <Link
                href={`/classes/${done.classSessionId}`}
                className="text-primary-text underline-offset-2 hover:underline"
              >
                See the class
              </Link>
            ) : null}
            <Link
              href="/account"
              className="text-primary-text underline-offset-2 hover:underline"
            >
              Your account
            </Link>
          </p>
        </div>
      ) : null}

      <form onSubmit={(e) => void onCheck(e)} className="mt-10 max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="redeem-code">Code</Label>
          <Input
            id="redeem-code"
            required
            value={code}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXXX-XXXXX-XXXXX"
            onChange={(e) => {
              setCode(e.target.value);
              setOffer(null);
              setError(null);
            }}
            className="font-mono tracking-wider"
            aria-describedby="redeem-code-help"
          />
          <p id="redeem-code-help" className="text-sm text-secondary">
            Capital or small letters, with or without the dashes.
          </p>
        </div>
        {offer ? null : (
          <Button type="submit" disabled={pending || !code.trim()}>
            {pending ? "Checking…" : "Check code"}
          </Button>
        )}
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-6 max-w-xl rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
        >
          {error}
        </p>
      ) : null}

      {offer ? (
        <section className="mt-6 max-w-xl rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-brown">
            This code is good for
          </h2>
          <p className="mt-2 text-charcoal">{offerLine(offer)}</p>
          {offer.expiresAt ? (
            <p className="mt-1 text-sm text-secondary">
              Use it by {formatDate(offer.expiresAt)}.
            </p>
          ) : null}

          {needsClass && !noClasses ? (
            <fieldset className="mt-5 space-y-2">
              <legend className="font-display text-sm font-medium text-brown">
                Choose the class
              </legend>
              {offer.classes!.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-page px-4 py-3"
                >
                  <input
                    type="radio"
                    name="redeem-class"
                    className="mt-1 size-5"
                    checked={classId === c.id}
                    onChange={() => setClassId(c.id)}
                  />
                  <span>
                    <span className="font-display font-semibold text-brown">{c.title}</span>
                    <span className="block text-sm text-secondary">
                      {formatDateTime(c.startsAt)} · {formatMoneyExact(c.priceCents)}
                    </span>
                  </span>
                </label>
              ))}
              {offer.maxPriceCents ? (
                <p className="text-sm text-secondary">
                  The code covers one class. Anything left over is not kept.
                </p>
              ) : null}
            </fieldset>
          ) : null}
          {noClasses ? (
            <p className="mt-4 text-brown">
              There is no class you can use it on right now: the class may be full, or
              you may already be booked. Your code is still good. Try again later or ask
              staff.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={pending || noClasses || (needsClass && !classId)}
              onClick={() => void onRedeem()}
            >
              {pending ? "Redeeming…" : "Redeem"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setOffer(null);
                setError(null);
              }}
            >
              Not now
            </Button>
          </div>
          <p className="mt-3 text-sm text-secondary">A code can be redeemed once.</p>
        </section>
      ) : null}
    </PageShell>
  );
}
