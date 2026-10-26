"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHero, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ApproveBody() {
  const params = useSearchParams();
  const challengeId = params.get("challenge") ?? "";
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/workstation/qr/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, email, pin }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not approve");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell className="max-w-lg">
      <PageHero
        eyebrow="Shop computer"
        title="Approve this desk"
        description="This signs you in on the shared PC. It does not sign you out of the website on your phone."
      />
      {!challengeId ? (
        <p className="mt-8 text-secondary">Missing challenge. Scan the QR again.</p>
      ) : done ? (
        <p className="mt-8 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-brown">
          Approved. The desk will finish signing you in. You can close this page.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              inputMode="numeric"
              autoComplete="off"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-accent" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Approving…" : "Approve desk login"}
          </Button>
        </form>
      )}
    </PageShell>
  );
}

export default function WorkstationApprovePage() {
  return (
    <Suspense fallback={<PageShell>Loading…</PageShell>}>
      <ApproveBody />
    </Suspense>
  );
}
