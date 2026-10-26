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
import {
  canProposeInterestBoard,
  canPublishInterestBoard,
  CLASS_INTEREST_DEFAULT_THRESHOLD,
  CLASS_INTEREST_OPEN_DAYS,
} from "@/lib/data";
import type {
  ClassCategory,
  ClassInterestBoardView,
  OrgSettings,
} from "@/lib/data";

const CATEGORIES: { value: ClassCategory; label: string }[] = [
  { value: "workshop", label: "Workshop" },
  { value: "orientation", label: "Orientation" },
  { value: "certification_checkoff", label: "Certification checkoff" },
  { value: "open_studio", label: "Open studio" },
];

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function statusTone(
  status: ClassInterestBoardView["status"],
): "ok" | "warn" | "info" | "muted" | "danger" {
  if (status === "ready") return "ok";
  if (status === "open") return "info";
  if (status === "pending") return "warn";
  if (status === "expired" || status === "cancelled") return "muted";
  return "info";
}

export default function InterestBoardPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [boards, setBoards] = useState<ClassInterestBoardView[]>([]);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, s] = await Promise.all([
        provider.listInterestBoards({ publicOnly: true }),
        provider.getSettings(),
      ]);
      if (cancelled) return;
      setBoards(list);
      setSettings(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#suggest") {
      setShowForm(true);
    }
  }, []);

  const canPropose = canProposeInterestBoard(currentUser);
  const publishesDirect = canPublishInterestBoard(currentUser);

  async function onPropose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      const board = await provider.proposeInterestBoard({
        title: String(form.get("title") ?? ""),
        summary: String(form.get("summary") ?? ""),
        category: String(form.get("category") ?? "workshop") as ClassCategory,
        threshold: Number(
          form.get("threshold") ?? CLASS_INTEREST_DEFAULT_THRESHOLD,
        ),
        proposedByUserId: currentUser?.id ?? null,
        contactName:
          String(form.get("contactName") ?? "") ||
          currentUser?.displayName ||
          "",
        contactEmail:
          String(form.get("contactEmail") ?? "") || currentUser?.email || "",
        instructorHintUserId: currentUser?.isTeacher
          ? currentUser.id
          : null,
        forcePending: !currentUser || !canPropose,
      });
      bump();
      setShowForm(false);
      setMessage(
        board.status === "open"
          ? "Your interest board is live — people can sign up now."
          : "Thanks — staff will review your idea before it goes on the board.",
      );
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit idea");
    } finally {
      setPending(false);
    }
  }

  async function onJoin(board: ClassInterestBoardView) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      if (!currentUser) {
        throw new Error("Sign in or open the board to join with your email");
      }
      await provider.joinInterestBoard({
        boardId: board.id,
        userId: currentUser.id,
        email: currentUser.email,
        displayName: currentUser.displayName,
      });
      bump();
      setMessage(`You’re on the list for “${board.title}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setPending(false);
    }
  }

  async function onLeave(board: ClassInterestBoardView) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    try {
      await provider.leaveInterestBoard(board.id, {
        userId: currentUser.id,
        email: currentUser.email,
      });
      bump();
      setMessage(`Removed from “${board.title}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setPending(false);
    }
  }

  const mailto = settings?.contactEmail
    ? `mailto:${settings.contactEmail}?subject=${encodeURIComponent("Class idea suggestion")}&body=${encodeURIComponent("Class idea:\n\nWho should take it:\n\nMy name / email:\n")}`
    : null;

  return (
    <PageShell>
      <PageHero
        eyebrow="Interest"
        title="Class interest board"
        description="Sign up for ideas you want to see run. When enough people raise their hand, staff schedules the class — interest list gets first dibs."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => {
            setShowForm(true);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "#suggest");
            }
          }}
        >
          Suggest a class
        </Button>
        <Button asChild variant="outline">
          <Link href="/classes">Scheduled classes</Link>
        </Button>
        {mailto ? (
          <Button asChild variant="ghost">
            <a href={mailto}>Email a suggestion</a>
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
          id="suggest"
          className="mt-10 max-w-xl scroll-mt-24 space-y-4 rounded-2xl border border-border bg-surface/60 p-6"
        >
          <p className="eyebrow">Suggest</p>
          <h2 className="font-display text-xl font-semibold text-charcoal">
            {publishesDirect
              ? "Publish an interest board"
              : canPropose
                ? "Propose a class idea"
                : "Suggest an idea (staff review)"}
          </h2>
          <p className="text-sm text-secondary">
            {publishesDirect
              ? `As a teacher or staff, your board goes live for ${CLASS_INTEREST_OPEN_DAYS} days.`
              : canPropose
                ? "Member proposals are reviewed by staff before the public board."
                : "Guests can suggest ideas; staff approve before signups open. Prefer email? Use the link above."}
          </p>
          <form onSubmit={onPropose} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Class title</Label>
              <Input id="title" name="title" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">What would it cover?</Label>
              <Textarea id="summary" name="summary" required rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className={selectClass}
                defaultValue="workshop"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {publishesDirect ? (
              <div className="space-y-2">
                <Label htmlFor="threshold">Minimum interested</Label>
                <Input
                  id="threshold"
                  name="threshold"
                  type="number"
                  min={3}
                  max={40}
                  defaultValue={CLASS_INTEREST_DEFAULT_THRESHOLD}
                />
              </div>
            ) : null}
            {!currentUser ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Your name</Label>
                  <Input id="contactName" name="contactName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    required
                  />
                </div>
              </>
            ) : null}
            <Button type="submit" disabled={pending}>
              {publishesDirect ? "Publish board" : "Submit idea"}
            </Button>
          </form>
        </section>
      ) : null}

      <section className="mt-14">
        <p className="eyebrow">Open boards</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-charcoal">
          Raise your hand
        </h2>
        {boards.length === 0 ? (
          <p className="mt-4 text-secondary">
            No open interest boards right now. Suggest one above.
          </p>
        ) : (
          <ul className="mt-8 space-y-6">
            {boards.map((board) => (
              <li
                key={board.id}
                className="border-b border-border pb-6 last:border-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/interest/${board.id}`}
                      className="font-display text-lg font-semibold text-charcoal hover:text-primary-text"
                    >
                      {board.title}
                    </Link>
                    <p className="mt-2 max-w-2xl text-sm text-secondary">
                      {board.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone={statusTone(board.status)}>
                        {board.status === "ready"
                          ? "Ready to schedule"
                          : board.status}
                      </StatusPill>
                      <StatusPill tone="muted">
                        {board.interestCount} / {board.threshold} interested
                      </StatusPill>
                      {board.daysRemaining != null ? (
                        <StatusPill tone="info">
                          {board.daysRemaining}d left
                        </StatusPill>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {board.viewerSignedUp ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void onLeave(board)}
                      >
                        Leave list
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={pending || !currentUser}
                        onClick={() => void onJoin(board)}
                      >
                        {currentUser ? "I’m interested" : "Sign in to join"}
                      </Button>
                    )}
                    <Button asChild variant="ghost">
                      <Link href={`/interest/${board.id}`}>Details</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!currentUser ? (
          <p className="mt-6 text-sm text-secondary">
            Guests can still join from a board’s detail page with name + email.
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}
