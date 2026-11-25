"use client";

import { useState, type FormEvent } from "react";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { formatCardNumber } from "@/lib/redemption-code";
import { formatMoneyExact, formatTier } from "@/lib/utils";
import type { CodeRedemption, StaffCodeOffer, User } from "@/lib/data";

type Person = Pick<User, "id" | "displayName" | "email">;

const selectClass =
  "h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal";

/** What the card gives, in a few words, before it is applied. */
function offerWords(offer: StaffCodeOffer): string {
  if (offer.kind === "credit") {
    return `${formatMoneyExact(offer.amountCents ?? 0)} shop credit`;
  }
  if (offer.kind === "membership") {
    const months = offer.months ?? 0;
    const until = offer.membershipEndsAt ? `, to ${formatDate(offer.membershipEndsAt)}` : "";
    return `${formatTier(offer.tier ?? null)} membership for ${months} month${months === 1 ? "" : "s"}${until}`;
  }
  return offer.maxPriceCents
    ? `One class, up to ${formatMoneyExact(offer.maxPriceCents)}`
    : "A seat in a class";
}

/** What happened, for the line staff read back to the person at the desk. */
function doneWords(done: CodeRedemption, name: string): string {
  if (done.kind === "credit") {
    return `${formatMoneyExact(done.amountCents ?? 0)} shop credit added for ${name}. Their balance is ${formatMoneyExact(done.balanceCents ?? 0)}.`;
  }
  if (done.kind === "membership") {
    const until = done.membershipEndsAt ? ` until ${formatDate(done.membershipEndsAt)}` : "";
    return `${name} now has a ${formatTier(done.tier ?? null)} membership${until}.`;
  }
  return `${name} is booked and paid for ${done.classTitle ?? "the class"}.`;
}

/**
 * Staff redeem a gift card for the person standing at the desk.
 *
 * Opened from a member's page, the member is fixed and staff type the card
 * number. Opened from a card in Admin → Codes, the card is fixed and staff
 * find the person, or add them when they have never signed in. Either way
 * staff see what the card gives and confirm before anything is applied.
 */
export function RedeemForMember({
  member: fixedMember,
  cardRef: fixedRef,
  cardLabel,
  onDone,
  onCancel,
}: {
  member?: Person;
  /** A card number ("014") or a full code, when the card is already chosen. */
  cardRef?: string;
  cardLabel?: string;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const { provider, bump } = useData();
  const [member, setMember] = useState<Person | null>(fixedMember ?? null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<User[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [typed, setTyped] = useState(fixedRef ?? "");
  const [offer, setOffer] = useState<StaffCodeOffer | null>(null);
  const [classId, setClassId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work. Please try again.");
    } finally {
      setPending(false);
    }
  }

  /** Look the card up for this person and show what it would give. */
  async function check(person: Person, ref: string) {
    const next = await provider.adminGetCodeOfferFor(person.id, ref);
    setOffer(next);
    setClassId(next.classes?.length === 1 ? next.classes[0]!.id : "");
  }

  function onFind(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const found = await provider.adminListMembers(query.trim());
      setMatches(found.slice(0, 8));
      setAdding(false);
    });
  }

  function pick(person: Person) {
    setMember(person);
    setMatches(null);
    setAdding(false);
    setOffer(null);
    if (fixedRef) void run(() => check(person, fixedRef));
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const created = await provider.adminCreateMember({ firstName, lastName, email });
      bump();
      setFirstName("");
      setLastName("");
      setEmail("");
      setMember(created);
      setMatches(null);
      setAdding(false);
      setOffer(null);
      if (fixedRef) await check(created, fixedRef);
    });
  }

  function onCheck(e: FormEvent) {
    e.preventDefault();
    if (!member) return;
    void run(() => check(member, typed));
  }

  function onConfirm() {
    if (!member || !offer) return;
    const ref = fixedRef ?? typed;
    void run(async () => {
      const done = await provider.adminRedeemCodeFor(
        member.id,
        ref,
        offer.kind === "class" ? { classSessionId: classId || undefined } : undefined,
      );
      const card = offer.cardNumber ? `Card ${formatCardNumber(offer.cardNumber)}: ` : "";
      setOffer(null);
      setTyped("");
      if (!fixedMember) setMember(null);
      bump();
      onDone(`${card}${doneWords(done, member.displayName)}`);
    });
  }

  const cardName =
    offer?.cardNumber != null
      ? `Card ${formatCardNumber(offer.cardNumber)}`
      : (cardLabel ?? "This code");

  return (
    <div className="max-w-xl space-y-5 rounded-2xl border border-border bg-surface/60 p-5">
      <h3 className="font-display text-lg font-semibold text-brown">
        {cardLabel ? `Redeem ${cardLabel} for a member` : "Redeem a gift card"}
      </h3>

      {error ? (
        <p role="alert" className="rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}

      {member ? (
        <p className="text-charcoal">
          For <span className="font-semibold">{member.displayName}</span>{" "}
          <span className="text-secondary">({member.email})</span>
          {fixedMember ? null : (
            <>
              {" "}
              <button
                type="button"
                className="text-primary-text underline underline-offset-2"
                onClick={() => {
                  setMember(null);
                  setOffer(null);
                }}
              >
                Change
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="space-y-4">
          <form onSubmit={onFind} className="space-y-2">
            <Label htmlFor="redeem-find">Who is it for</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="redeem-find"
                className="min-w-0 flex-1"
                value={query}
                placeholder="Name or email"
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button type="submit" variant="outline" disabled={pending || !query.trim()}>
                Find
              </Button>
            </div>
          </form>

          {matches ? (
            matches.length > 0 ? (
              <ul className="divide-y divide-border border-y border-border">
                {matches.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-display font-semibold text-brown">
                        {u.displayName || u.email}
                      </span>{" "}
                      <span className="text-sm text-secondary">{u.email}</span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Choose ${u.displayName || u.email}`}
                      disabled={pending}
                      onClick={() => pick(u)}
                    >
                      Choose
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-secondary">Nobody by that name or email yet.</p>
            )
          ) : null}

          {adding ? (
            <form onSubmit={onAdd} className="space-y-4 border-t border-border pt-4">
              <p className="text-sm text-secondary">
                For someone who has never signed in. They can sign in later with this
                email and find the card already on their account.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="redeem-first">First name</Label>
                  <Input
                    id="redeem-first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redeem-last">Last name</Label>
                  <Input
                    id="redeem-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="redeem-email">Email</Label>
                <Input
                  id="redeem-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add this person"}
              </Button>
            </form>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setAdding(true)}>
              Add a new person
            </Button>
          )}
        </div>
      )}

      {member && !fixedRef && !offer ? (
        <form onSubmit={onCheck} className="space-y-2">
          <Label htmlFor="redeem-card">Card number or code</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="redeem-card"
              className="min-w-0 flex-1"
              value={typed}
              placeholder="014"
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={pending || !typed.trim()}>
              {pending ? "Checking…" : "Check"}
            </Button>
          </div>
        </form>
      ) : null}

      {member && offer ? (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-charcoal">
            {cardName} gives{" "}
            <span className="font-display font-semibold text-brown">{offerWords(offer)}</span>.
          </p>
          {offer.kind === "class" ? (
            offer.classes && offer.classes.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="redeem-class">Which class</Label>
                <select
                  id="redeem-class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Choose a class</option>
                  {offer.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {formatDate(c.startsAt)} · {formatMoneyExact(c.priceCents)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-secondary">
                There is no class this card can be used on right now. The card has not
                been used.
              </p>
            )
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={pending || (offer.kind === "class" && !classId)}
              onClick={onConfirm}
            >
              {pending ? "Redeeming…" : `Redeem for ${member.displayName}`}
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
          <p className="text-sm text-secondary">A card works once. This cannot be undone.</p>
        </div>
      ) : null}

      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      ) : null}
    </div>
  );
}
