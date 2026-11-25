"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { AdminNotice } from "@/components/admin/admin-notice";
import { RedeemForMember } from "@/components/admin/redeem-for-member";
import { StaffGate } from "@/components/staff-gate";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCardNumber, formatCode, parseCardNumber } from "@/lib/redemption-code";
import { useNow } from "@/lib/use-now";
import { formatMoneyExact, formatTier } from "@/lib/utils";
import type {
  ClassSessionView,
  MembershipTier,
  RedemptionCodeKind,
  RedemptionCodeView,
} from "@/lib/data";

const TIERS: MembershipTier[] = [
  "day",
  "community",
  "maker",
  "patron",
  "friend",
  "scholarship",
  "shop_steward",
  "household_addon",
  "maker_pro",
  "unlimited",
  "team",
];

const KIND_LABEL: Record<RedemptionCodeKind, string> = {
  credit: "Shop credit",
  membership: "Membership",
  class: "A class",
};

const selectClass =
  "h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal";

type Filter = "unused" | "redeemed" | "voided";

function statusOf(code: RedemptionCodeView, now: number): Filter | "expired" {
  if (code.voidedAt) return "voided";
  if (code.redeemedAt) return "redeemed";
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= now) return "expired";
  return "unused";
}

/** What the code gives, in a few words. */
function worth(code: RedemptionCodeView): string {
  if (code.kind === "credit") return `${formatMoneyExact(code.amountCents ?? 0)} shop credit`;
  if (code.kind === "membership") {
    return `${formatTier(code.tier)} membership, ${code.months} month${code.months === 1 ? "" : "s"}`;
  }
  return code.classSessionId
    ? `A seat in ${code.classTitle ?? "a class"}`
    : `Any one class up to ${formatMoneyExact(code.maxPriceCents ?? 0)}`;
}

export default function AdminCodesPage() {
  const { provider, revision, bump } = useData();
  // Unknown until the page is in the browser; nothing counts as expired or
  // past until then.
  const now = useNow() ?? 0;
  const [codes, setCodes] = useState<RedemptionCodeView[]>([]);
  const [classes, setClasses] = useState<ClassSessionView[]>([]);
  const [filter, setFilter] = useState<Filter>("unused");
  const [picked, setPicked] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<RedemptionCodeKind>("credit");
  const [amount, setAmount] = useState("25");
  const [tier, setTier] = useState<MembershipTier>("maker");
  const [months, setMonths] = useState("1");
  const [classId, setClassId] = useState("");
  const [maxPrice, setMaxPrice] = useState("50");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [expires, setExpires] = useState("");
  const [asCards, setAsCards] = useState(false);
  const [firstCard, setFirstCard] = useState("");
  const [search, setSearch] = useState("");
  const [redeeming, setRedeeming] = useState<RedemptionCodeView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([provider.adminListCodes(), provider.adminListClasses()]).then(
      ([list, sessions]) => {
        if (cancelled) return;
        setCodes(list);
        setClasses(sessions);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const upcoming = useMemo(
    () =>
      classes
        .filter((c) => !c.cancelledAt && new Date(c.startsAt).getTime() > now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [classes, now],
  );

  /** One more than the highest card number in use: where the next batch starts. */
  const nextCard = useMemo(
    () => codes.reduce((max, c) => Math.max(max, c.cardNumber ?? 0), 0) + 1,
    [codes],
  );

  const shown = useMemo(() => {
    const wanted = search.trim();
    if (wanted) {
      // Looking a card up: whatever its status, so a used one is found too.
      const card = parseCardNumber(wanted);
      const text = wanted.toLowerCase();
      const asCode = wanted.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return codes.filter((c) =>
        card !== null
          ? c.cardNumber === card
          : (c.note ?? "").toLowerCase().includes(text) ||
            (c.zeffyPaymentId ?? "").toLowerCase().includes(text) ||
            (asCode.length >= 4 && c.code.includes(asCode)),
      );
    }
    return codes.filter((c) => {
      const status = statusOf(c, now);
      return filter === "unused" ? status === "unused" || status === "expired" : status === filter;
    });
  }, [codes, filter, now, search]);

  const toPrint = codes.filter(
    (c) => picked.includes(c.id) && statusOf(c, now) === "unused",
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const made = await provider.adminCreateCodes({
        kind,
        amountCents: kind === "credit" ? Math.round(Number(amount) * 100) : undefined,
        tier: kind === "membership" ? tier : undefined,
        months: kind === "membership" ? Number(months) : undefined,
        classSessionId: kind === "class" && classId ? classId : null,
        maxPriceCents:
          kind === "class" && !classId ? Math.round(Number(maxPrice) * 100) : null,
        quantity: Number(quantity),
        note,
        zeffyPaymentId: paymentId,
        expiresAt: expires || null,
        numberAsCards: asCards,
        firstCardNumber: asCards && firstCard.trim() ? Number(firstCard) : undefined,
      });
      const firstMade = made[0]!;
      const lastMade = made[made.length - 1]!;
      setMessage(
        firstMade.cardNumber
          ? made.length === 1
            ? `Made card ${formatCardNumber(firstMade.cardNumber)}. It is ticked below, ready to print.`
            : `Made cards ${formatCardNumber(firstMade.cardNumber)} to ${formatCardNumber(lastMade.cardNumber ?? 0)}. They are ticked below, ready to print.`
          : made.length === 1
            ? `Made 1 code: ${formatCode(firstMade.code)}`
            : `Made ${made.length} codes. They are ticked below, ready to print.`,
      );
      setFirstCard("");
      setSearch("");
      setPicked(made.map((c) => c.id));
      setFilter("unused");
      setNote("");
      setPaymentId("");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the codes.");
    } finally {
      setPending(false);
    }
  }

  async function onVoid(code: RedemptionCodeView) {
    if (!window.confirm(`Void ${formatCode(code.code)}? It can never be redeemed after this.`)) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await provider.adminVoidCode(code.id);
      setMessage(`Voided ${formatCode(code.code)}.`);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void that code.");
      bump();
    }
  }

  if (printing) {
    return (
      <StaffGate>
        <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="no-print mb-8 flex flex-wrap gap-3">
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
          <Button type="button" variant="outline" onClick={() => setPrinting(false)}>
            Back to codes
          </Button>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {toPrint.map((code) => (
            <li
              key={code.id}
              className="break-inside-avoid rounded-2xl border border-brown/40 p-5 text-brown"
            >
              <p className="font-display text-sm font-semibold">
                Discover Burien Makerspace
              </p>
              {code.cardNumber ? (
                <p className="mt-3 font-display text-4xl font-semibold tracking-wide">
                  Card {formatCardNumber(code.cardNumber)}
                </p>
              ) : null}
              <p className="mt-3 font-display text-lg font-semibold">{worth(code)}</p>
              <p className="mt-3 font-mono text-xl tracking-wider">{formatCode(code.code)}</p>
              {code.cardNumber ? (
                <p className="mt-3 text-sm">
                  Staff record: this is the code behind card{" "}
                  {formatCardNumber(code.cardNumber)}. Staff redeem the card at the desk
                  by its number. It works once.
                </p>
              ) : (
                <p className="mt-3 text-sm">
                  Sign in at discoverburienmakerspace.com, open Redeem a code, and type
                  this code. It works once.
                </p>
              )}
              {code.note ? <p className="mt-1 text-sm">{code.note}</p> : null}
              {code.expiresAt ? (
                <p className="mt-1 text-sm">Use by {formatDate(code.expiresAt)}.</p>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      </StaffGate>
    );
  }

  return (
    <AdminShell
      title="Codes"
      description="Gift cards and promo codes. Make a code here and hand it over. The person redeems it once on the Redeem a code page, or staff redeem a numbered card for them here."
    >
      <AdminNotice message={message} error={error} />

      <form onSubmit={(e) => void onCreate(e)} className="max-w-xl space-y-5">
        <h2 className="font-display text-xl font-semibold text-brown">Make codes</h2>
        <div className="space-y-2">
          <Label htmlFor="code-kind">What is it for</Label>
          <select
            id="code-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as RedemptionCodeKind)}
            className={selectClass}
          >
            {(Object.keys(KIND_LABEL) as RedemptionCodeKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        {kind === "credit" ? (
          <div className="space-y-2">
            <Label htmlFor="code-amount">Amount ($)</Label>
            <Input
              id="code-amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby="code-amount-help"
            />
            <p id="code-amount-help" className="text-sm text-secondary">
              Added to the person’s shop credit, which pays for machine time and classes.
            </p>
          </div>
        ) : null}

        {kind === "membership" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code-tier">Membership</Label>
              <select
                id="code-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as MembershipTier)}
                className={selectClass}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {formatTier(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code-months">Months</Label>
              <Input
                id="code-months"
                required
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <p className="text-sm text-secondary sm:col-span-2">
              The membership starts when the code is redeemed and ends by itself after
              that many months. Someone already paying for a membership cannot redeem
              it; turn it into shop credit for them instead.
            </p>
          </div>
        ) : null}

        {kind === "class" ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="code-class">Which class</Label>
              <select
                id="code-class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className={selectClass}
              >
                <option value="">Any one class, up to a price</option>
                {upcoming.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {formatDate(c.startsAt)} · {formatMoneyExact(c.priceCents)}
                  </option>
                ))}
              </select>
            </div>
            {classId ? null : (
              <div className="space-y-2">
                <Label htmlFor="code-max">Highest class price it covers ($)</Label>
                <Input
                  id="code-max"
                  required
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            )}
            <p className="text-sm text-secondary">
              The person picks the class when they redeem, and gets a paid seat. If they
              cancel in time, the class price comes back to them as shop credit.
            </p>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code-quantity">How many codes</Label>
            <Input
              id="code-quantity"
              required
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-describedby="code-quantity-help"
            />
            <p id="code-quantity-help" className="text-sm text-secondary">
              Up to 50 at a time, all the same.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code-expires">Expires (optional)</Label>
            <Input
              id="code-expires"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              aria-describedby="code-expires-help"
            />
          </div>
        </div>
        <p id="code-expires-help" className="text-sm text-secondary">
          Washington generally does not allow a gift card someone paid for to expire.
          Only set this on free or promotional codes, and check if unsure.
        </p>

        <div className="space-y-3 rounded-2xl border border-border bg-surface/60 px-4 py-4">
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={asCards}
              onChange={(e) => setAsCards(e.target.checked)}
            />
            Number these as gift cards
          </label>
          <p className="text-sm text-secondary">
            For printed cards that carry only a short number. Staff redeem a card at
            the desk by its number; the full code stays on your printed sheet.
          </p>
          {asCards ? (
            <div className="space-y-2">
              <Label htmlFor="code-first-card">First card number</Label>
              <Input
                id="code-first-card"
                inputMode="numeric"
                value={firstCard}
                placeholder={formatCardNumber(nextCard)}
                onChange={(e) => setFirstCard(e.target.value)}
                aria-describedby="code-first-card-help"
              />
              <p id="code-first-card-help" className="text-sm text-secondary">
                Leave blank to carry on from {formatCardNumber(nextCard)}. The batch is
                numbered in order from here.
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="code-note">Note (optional)</Label>
          <Input
            id="code-note"
            value={note}
            placeholder="Who bought it, card number"
            onChange={(e) => setNote(e.target.value)}
            aria-describedby="code-note-help"
          />
          <p id="code-note-help" className="text-sm text-secondary">
            Only staff see this.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code-payment">Zeffy payment ID (optional)</Label>
          <Input
            id="code-payment"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            aria-describedby="code-payment-help"
          />
          <p id="code-payment-help" className="text-sm text-secondary">
            For a gift card sold through Zeffy: make the code after you see the
            payment, then send it to the buyer.
          </p>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Making…" : "Make codes"}
        </Button>
      </form>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-xl font-semibold text-brown">All codes</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="code-filter">Show</Label>
            <select
              id="code-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="h-11 rounded-full border border-border bg-surface px-4 text-charcoal"
            >
              <option value="unused">Not used yet</option>
              <option value="redeemed">Redeemed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code-search">Find a card</Label>
            <Input
              id="code-search"
              className="w-44"
              inputMode="search"
              value={search}
              placeholder="Card number or note"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={toPrint.length === 0}
            onClick={() => setPrinting(true)}
          >
            Print {toPrint.length || ""} ticked
          </Button>
        </div>

        {redeeming ? (
          <div className="mt-6">
            <RedeemForMember
              key={redeeming.id}
              cardRef={
                redeeming.cardNumber
                  ? formatCardNumber(redeeming.cardNumber)
                  : redeeming.code
              }
              cardLabel={
                redeeming.cardNumber
                  ? `card ${formatCardNumber(redeeming.cardNumber)}`
                  : formatCode(redeeming.code)
              }
              onDone={(text) => {
                setRedeeming(null);
                setError(null);
                setMessage(text);
                window.scrollTo({ top: 0 });
              }}
              onCancel={() => setRedeeming(null)}
            />
          </div>
        ) : null}
        {search.trim() && shown.length === 0 ? (
          <p className="mt-6 text-secondary">No card or code matches that.</p>
        ) : null}

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {shown.map((code) => {
            const status = statusOf(code, now);
            return (
              <li key={code.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  {status === "unused" ? (
                    <input
                      type="checkbox"
                      className="mt-1 size-5"
                      aria-label={`Tick ${formatCode(code.code)} to print`}
                      checked={picked.includes(code.id)}
                      onChange={(e) =>
                        setPicked((ids) =>
                          e.target.checked
                            ? [...ids, code.id]
                            : ids.filter((id) => id !== code.id),
                        )
                      }
                    />
                  ) : null}
                  <div className="min-w-0">
                    {code.cardNumber ? (
                      <p className="font-display text-lg font-semibold text-brown">
                        Card {formatCardNumber(code.cardNumber)}
                      </p>
                    ) : null}
                    <p className="font-mono text-charcoal">{formatCode(code.code)}</p>
                    <p className="font-display font-semibold text-brown">{worth(code)}</p>
                    <p className="text-sm text-secondary">
                      Made {formatDate(code.createdAt)}
                      {code.note ? ` · ${code.note}` : ""}
                      {code.zeffyPaymentId ? ` · Zeffy ${code.zeffyPaymentId}` : ""}
                      {code.expiresAt ? ` · expires ${formatDate(code.expiresAt)}` : ""}
                    </p>
                    {code.redeemedAt ? (
                      <p className="text-sm text-secondary">
                        Redeemed {formatDateTime(code.redeemedAt)} by{" "}
                        {code.redeemedByUserId ? (
                          <Link
                            href={`/admin/members/${code.redeemedByUserId}`}
                            className="text-primary-text underline-offset-2 hover:underline"
                          >
                            {code.redeemedByName ?? "a member"}
                          </Link>
                        ) : (
                          "someone"
                        )}
                        {code.redeemedByStaffName
                          ? `, at the desk by ${code.redeemedByStaffName}`
                          : ""}
                        {code.redeemedSummary ? ` · ${code.redeemedSummary}` : ""}
                      </p>
                    ) : null}
                    {code.redeemedAt && !code.redeemedSummary ? (
                      <p className="mt-1 text-sm text-brown">
                        This one was claimed but did not finish. Open the member, check
                        what they received, and add what is missing by hand.
                      </p>
                    ) : null}
                    {code.voidedAt ? (
                      <p className="text-sm text-secondary">
                        Voided {formatDateTime(code.voidedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {status === "expired" ? <StatusPill tone="muted">Expired</StatusPill> : null}
                  {status === "redeemed" && search.trim() ? (
                    <StatusPill tone="muted">Redeemed</StatusPill>
                  ) : null}
                  {status === "voided" && search.trim() ? (
                    <StatusPill tone="muted">Voided</StatusPill>
                  ) : null}
                  {status === "unused" ? (
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Redeem ${code.cardNumber ? `card ${formatCardNumber(code.cardNumber)}` : formatCode(code.code)} for a member`}
                      onClick={() => {
                        setMessage(null);
                        setError(null);
                        setRedeeming(code);
                      }}
                    >
                      Redeem for a member
                    </Button>
                  ) : null}
                  {status === "unused" || status === "expired" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Void ${formatCode(code.code)}`}
                      onClick={() => void onVoid(code)}
                    >
                      Void
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && !search.trim() ? (
          <p className="mt-4 text-secondary">Nothing here.</p>
        ) : null}
      </section>
    </AdminShell>
  );
}
