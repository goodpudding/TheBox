"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canClaimBounty, canCompleteBounty } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { BountyStatus, BountyView } from "@/lib/data";

function statusTone(
  status: BountyStatus,
): "ok" | "warn" | "info" | "muted" {
  if (status === "open") return "info";
  if (status === "claimed") return "warn";
  return "ok";
}

function statusLabel(bounty: BountyView): string {
  if (bounty.status === "claimed" && bounty.claimedByDisplayName) {
    return `Claimed · ${bounty.claimedByDisplayName}`;
  }
  if (bounty.status === "completed") return "Completed";
  return "Open";
}

export default function BountiesPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [bounties, setBounties] = useState<BountyView[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canClaim = canClaimBounty(currentUser);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentUser) {
        if (!cancelled) setBounties([]);
        return;
      }
      const list = await provider.listBounties();
      if (!cancelled) setBounties(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision, currentUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#request") setShowForm(true);
    if (!currentUser) setShowForm(true);
  }, [currentUser]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(formEl);
    try {
      await provider.submitBountyRequest({
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        requesterName:
          String(form.get("requesterName") ?? "") ||
          currentUser?.displayName ||
          "",
        requesterEmail:
          String(form.get("requesterEmail") ?? "") || currentUser?.email || "",
        businessName: String(form.get("businessName") ?? "") || null,
        userId: currentUser?.id ?? null,
      });
      formEl.reset();
      bump();
      setShowForm(false);
      setMessage(
        "Thanks — your request is on the board. A member will claim it if they can make it.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setPending(false);
    }
  }

  async function onClaim(bounty: BountyView) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.claimBounty(bounty.id, currentUser.id);
      bump();
      setMessage(`You claimed “${bounty.title}”. Reach out to finish it in the shop.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim");
    } finally {
      setPending(false);
    }
  }

  async function onComplete(bounty: BountyView) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.completeBounty(bounty.id, currentUser.id);
      bump();
      setMessage(`Marked “${bounty.title}” completed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete");
    } finally {
      setPending(false);
    }
  }

  const openOrClaimed = bounties.filter((b) => b.status !== "completed");
  const completed = bounties.filter((b) => b.status === "completed");

  return (
    <PageShell>
      <PageHero
        eyebrow="Make for the neighborhood"
        title="Bounty board"
        description="Ask members to make something custom in the shop — signs, small runs, embroidered gear. Members claim a request so it isn’t double-booked."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => {
            setShowForm(true);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "#request");
            }
          }}
        >
          Request something made
        </Button>
        <Button asChild variant="outline">
          <Link href="/made">Made here</Link>
        </Button>
        {!currentUser ? (
          <Button asChild variant="ghost">
            <Link href="/login">Members · sign in to claim</Link>
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 text-sm text-primary-text">{message}</p>
      ) : null}

      {showForm ? (
        <section
          id="request"
          className="mt-10 max-w-xl scroll-mt-24 space-y-4 rounded-2xl border border-border bg-surface/60 p-6"
        >
          <p className="eyebrow">Request</p>
          <h2 className="font-display text-xl font-semibold text-charcoal">
            What should we make?
          </h2>
          <p className="text-sm text-secondary">
            No payment on this board — it’s a handshake with a member who can
            make it during shop hours. Share enough detail that someone can
            decide whether to claim it.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">What do you want made?</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={120}
                placeholder="Laser-cut sandwich board"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Details</Label>
              <Textarea
                id="description"
                name="description"
                required
                rows={4}
                maxLength={2000}
                placeholder="Size, materials, quantity, logo files, timing…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business or project (optional)</Label>
              <Input
                id="businessName"
                name="businessName"
                maxLength={80}
                placeholder="Cafe, shop, or your own name"
              />
            </div>
            {!currentUser ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="requesterName">Your name</Label>
                  <Input id="requesterName" name="requesterName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requesterEmail">Email</Label>
                  <Input
                    id="requesterEmail"
                    name="requesterEmail"
                    type="email"
                    required
                  />
                </div>
              </>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Submit request"}
            </Button>
          </form>
        </section>
      ) : null}

      {!currentUser ? (
        <p className="mt-10 max-w-xl text-sm text-secondary leading-relaxed">
          The live board — including who claimed each request — is for signed-in
          members so requests aren’t double-claimed.{" "}
          <Link href="/login" className="text-primary-text underline">
            Sign in
          </Link>{" "}
          if you have a membership, or{" "}
          <Link href="/join" className="text-primary-text underline">
            join The Box
          </Link>
          .
        </p>
      ) : (
        <section className="mt-14">
          <p className="eyebrow">Member board</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-charcoal">
            Open and claimed
          </h2>
          {!canClaim ? (
            <p className="mt-3 max-w-xl text-sm text-secondary">
              You can submit requests. Claiming is for active members with shop
              access.
            </p>
          ) : null}
          {openOrClaimed.length === 0 ? (
            <p className="mt-4 text-secondary">
              No open or claimed bounties right now. Submit one above.
            </p>
          ) : (
            <ul className="mt-8 space-y-6">
              {openOrClaimed.map((bounty) => (
                <BountyRow
                  key={bounty.id}
                  bounty={bounty}
                  pending={pending}
                  canClaim={canClaim && bounty.status === "open"}
                  canComplete={
                    bounty.status === "claimed" &&
                    canCompleteBounty(currentUser, bounty)
                  }
                  onClaim={() => void onClaim(bounty)}
                  onComplete={() => void onComplete(bounty)}
                />
              ))}
            </ul>
          )}

          {completed.length > 0 ? (
            <div className="mt-14">
              <p className="eyebrow">Recently completed</p>
              <ul className="mt-6 space-y-6">
                {completed.map((bounty) => (
                  <BountyRow
                    key={bounty.id}
                    bounty={bounty}
                    pending={pending}
                    canClaim={false}
                    canComplete={false}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}
    </PageShell>
  );
}

function BountyRow({
  bounty,
  pending,
  canClaim,
  canComplete,
  onClaim,
  onComplete,
}: {
  bounty: BountyView;
  pending: boolean;
  canClaim: boolean;
  canComplete: boolean;
  onClaim?: () => void;
  onComplete?: () => void;
}) {
  return (
    <li className="border-b border-border pb-6 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-charcoal">
            {bounty.title}
          </h3>
          {bounty.businessName ? (
            <p className="mt-1 font-display text-sm text-primary-text">
              {bounty.businessName}
            </p>
          ) : null}
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            {bounty.description}
          </p>
          <p className="mt-2 text-sm text-secondary">
            From {bounty.requesterName}
            {bounty.requesterEmail ? ` · ${bounty.requesterEmail}` : ""}
            {` · ${formatDate(bounty.createdAt)}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill tone={statusTone(bounty.status)}>
              {statusLabel(bounty)}
            </StatusPill>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canClaim ? (
            <Button type="button" disabled={pending} onClick={onClaim}>
              Claim this
            </Button>
          ) : bounty.status === "claimed" ? (
            <Button type="button" variant="outline" disabled>
              Claimed
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onComplete}
            >
              Mark completed
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
