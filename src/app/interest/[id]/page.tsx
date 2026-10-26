"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassInterestBoardView } from "@/lib/data";

export default function InterestBoardDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { provider, currentUser, revision, bump } = useData();
  const [board, setBoard] = useState<ClassInterestBoardView | null | undefined>(
    undefined,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const row = await provider.getInterestBoard(id, currentUser?.id);
      if (!cancelled) setBoard(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, id, currentUser?.id, revision]);

  async function onJoin(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!board) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      let email = currentUser?.email ?? "";
      let displayName = currentUser?.displayName ?? "";
      if (e) {
        const form = new FormData(e.currentTarget);
        email = String(form.get("email") ?? "");
        displayName = String(form.get("displayName") ?? "");
      }
      await provider.joinInterestBoard({
        boardId: board.id,
        userId: currentUser?.id ?? null,
        email,
        displayName,
      });
      bump();
      setMessage("You’re on the interest list.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setPending(false);
    }
  }

  async function onLeave() {
    if (!board) return;
    setPending(true);
    setError(null);
    try {
      await provider.leaveInterestBoard(board.id, {
        userId: currentUser?.id,
        email: currentUser?.email,
      });
      bump();
      setMessage("Removed from the list.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setPending(false);
    }
  }

  if (board === undefined) {
    return (
      <PageShell>
        <p className="text-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (!board) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Interest"
          title="Not found"
          description="That interest board doesn’t exist."
        />
        <Button asChild className="mt-8">
          <Link href="/interest">Back to board</Link>
        </Button>
      </PageShell>
    );
  }

  const canJoin = board.status === "open" || board.status === "ready";

  return (
    <PageShell>
      <p className="mb-4">
        <Link
          href="/interest"
          className="font-display text-sm font-semibold text-primary-text hover:underline"
        >
          ← Interest board
        </Link>
      </p>
      <PageHero
        eyebrow="Interest"
        title={board.title}
        description={board.summary}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        <StatusPill tone={board.status === "ready" ? "ok" : "info"}>
          {board.status}
        </StatusPill>
        <StatusPill tone="muted">
          {board.interestCount} / {board.threshold} interested
        </StatusPill>
        {board.daysRemaining != null ? (
          <StatusPill tone="info">{board.daysRemaining} days left</StatusPill>
        ) : null}
      </div>

      {board.instructorHintDisplayName ? (
        <p className="mt-4 text-sm text-secondary">
          Suggested instructor: {board.instructorHintDisplayName}
        </p>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 text-sm text-primary-text">{message}</p>
      ) : null}

      <section className="mt-10 max-w-md space-y-4">
        {!canJoin ? (
          <p className="text-secondary">
            This board isn’t accepting new interest signups.
          </p>
        ) : board.viewerSignedUp ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void onLeave()}
          >
            Leave interest list
          </Button>
        ) : currentUser ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void onJoin()}
          >
            I’m interested
          </Button>
        ) : (
          <form onSubmit={(e) => void onJoin(e)} className="space-y-4">
            <p className="text-sm text-secondary">
              Join with your email — no membership required.
            </p>
            <div className="space-y-2">
              <Label htmlFor="displayName">Name</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" disabled={pending}>
              Join interest list
            </Button>
          </form>
        )}
      </section>

      {board.scheduledClassSessionId ? (
        <p className="mt-10 text-sm">
          <Link
            href={`/classes/${board.scheduledClassSessionId}`}
            className="font-semibold text-primary-text hover:underline"
          >
            View scheduled class →
          </Link>
        </p>
      ) : null}
    </PageShell>
  );
}
