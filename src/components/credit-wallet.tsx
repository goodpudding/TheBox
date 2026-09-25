"use client";

import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";
import { formatMoneyExact } from "@/lib/utils";
import { ledgerKindLabel } from "@/lib/credits";
import type { CreditWallet } from "@/lib/data";

export function CreditWalletPanel({
  wallet,
  href,
}: {
  wallet: CreditWallet;
  href?: string;
}) {
  const negative = wallet.balanceCents < 0;
  const recent = wallet.entries.slice(0, 6);

  return (
    <section className="rounded-[1.75rem] border border-primary/25 bg-primary/10 px-5 py-6 sm:px-7">
      <p className="eyebrow">Machine credits</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold text-brown">
          {formatMoneyExact(wallet.balanceCents)}
        </h2>
        <StatusPill tone={negative ? "warn" : "ok"}>
          {negative ? "Owes the shop" : "Spendable"}
        </StatusPill>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-secondary leading-relaxed">
        One wallet in this app — Zeffy never holds it. Spend on machine time or
        a class. If a job runs past zero, you still finish; next month’s $50
        Plus grant pays the debt first.
      </p>
      {negative ? (
        <p className="mt-3 max-w-2xl text-sm text-brown leading-relaxed">
          Balance is negative from a finished job. The next Membership Plus $50
          grant pays this down first; leftover is spendable. You can also pay
          us back at the desk (staff grant or a Zeffy payment applied as
          credit). This app never charges your card.
        </p>
      ) : null}
      {recent.length > 0 ? (
        <ul className="mt-5 divide-y divide-border/80 border-y border-border/80">
          {recent.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
            >
              <div>
                <p className="font-display text-sm font-medium text-brown">
                  {e.note?.trim() || ledgerKindLabel(e.kind)}
                </p>
                <p className="text-xs text-secondary">
                  {formatDateTime(e.occurredAt)}
                </p>
              </div>
              <span
                className={
                  e.amountCents < 0
                    ? "font-display text-sm font-semibold text-brown"
                    : "font-display text-sm font-semibold text-primary-text"
                }
              >
                {e.amountCents > 0 ? "+" : ""}
                {formatMoneyExact(e.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-secondary">
          No ledger lines yet. Other memberships start at $0 unless you buy a
          credit-eligible product (Plus) or staff grants credit.
        </p>
      )}
      {href ? (
        <p className="mt-4">
          <Link
            href={href}
            className="font-display text-sm font-semibold text-primary-text hover:underline"
          >
            Full ledger on account →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
