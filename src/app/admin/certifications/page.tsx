"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Certification, User } from "@/lib/data";

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AdminCertificationsPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Certification | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [checkMemberId, setCheckMemberId] = useState("");
  const [checkCertId, setCheckCertId] = useState("");
  const [revokeMemberId, setRevokeMemberId] = useState("");
  const [revokeCertId, setRevokeCertId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  useEffect(() => {
    void (async () => {
      const [c, m] = await Promise.all([
        provider.listCertifications(),
        provider.adminListMembers(),
      ]);
      setCerts(c);
      setMembers(m);
      if (!checkCertId && c[0]) setCheckCertId(c[0].id);
      if (!revokeCertId && c[0]) setRevokeCertId(c[0].id);
      if (!checkMemberId && m[0]) setCheckMemberId(m[0].id);
      if (!revokeMemberId && m[0]) setRevokeMemberId(m[0].id);
    })();
  }, [provider, revision]);

  async function onUpsert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const expiryRaw = String(form.get("expiryMonths") ?? "").trim();
    try {
      await provider.adminUpsertCertification({
        id: editing?.id,
        name: String(form.get("name") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        knowledgeOnly: form.get("knowledgeOnly") === "on",
        expiryMonths: expiryRaw ? Number(expiryRaw) : null,
        active: form.get("active") === "on",
        description: editing?.description ?? "",
      });
      setEditing(null);
      bump();
      setMessage(editing ? "Certification updated." : "Certification created.");
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save certification");
    } finally {
      setPending(false);
    }
  }

  async function onCheckoff(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !checkMemberId || !checkCertId) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminRecordCheckoff({
        userId: checkMemberId,
        certificationId: checkCertId,
        actorId: currentUser.id,
      });
      bump();
      setMessage("Checkoff recorded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record checkoff");
    } finally {
      setPending(false);
    }
  }

  async function onRevoke(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !revokeMemberId || !revokeCertId || !revokeReason.trim())
      return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminRevokeCertification({
        userId: revokeMemberId,
        certificationId: revokeCertId,
        actorId: currentUser.id,
        reason: revokeReason.trim(),
      });
      bump();
      setRevokeReason("");
      setMessage("Certification revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Certifications"
      description="Maintain the certification catalog, record hands-on checkoffs, and revoke when needed."
    >
      {error ? (
        <p className="mb-6 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-6 text-sm text-primary-text">{message}</p>
      ) : null}

      <section>
        <p className="eyebrow">Catalog</p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {certs.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4"
            >
              <div>
                <p className="font-display font-semibold text-brown">{c.name}</p>
                <p className="font-mono text-xs text-secondary">{c.slug}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.knowledgeOnly ? (
                    <StatusPill tone="info">Knowledge-only</StatusPill>
                  ) : null}
                  {c.expiryMonths != null ? (
                    <StatusPill tone="muted">{c.expiryMonths} mo expiry</StatusPill>
                  ) : (
                    <StatusPill tone="muted">No expiry</StatusPill>
                  )}
                  <StatusPill tone={c.active ? "ok" : "danger"}>
                    {c.active ? "Active" : "Inactive"}
                  </StatusPill>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(c);
                  setMessage(null);
                  setError(null);
                }}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 max-w-xl">
        <p className="eyebrow">{editing ? "Edit certification" : "Add certification"}</p>
        {editing ? (
          <p className="mt-2 text-sm text-secondary">
            Editing {editing.name}.{" "}
            <button
              type="button"
              className="font-display font-semibold text-primary-text hover:underline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </p>
        ) : null}
        <form
          key={editing?.id ?? "new"}
          onSubmit={onUpsert}
          className="mt-4 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="cert-name">Name</Label>
            <Input
              id="cert-name"
              name="name"
              required
              defaultValue={editing?.name ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert-slug">Slug</Label>
            <Input
              id="cert-slug"
              name="slug"
              required
              defaultValue={editing?.slug ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert-expiry">Expiry months (blank = none)</Label>
            <Input
              id="cert-expiry"
              name="expiryMonths"
              type="number"
              min={0}
              defaultValue={editing?.expiryMonths ?? ""}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              name="knowledgeOnly"
              defaultChecked={editing?.knowledgeOnly ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Knowledge-only (no hands-on checkoff)
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
              className="h-4 w-4 rounded border-border"
            />
            Active
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : editing ? "Update" : "Create"}
          </Button>
        </form>
      </section>

      <section className="mt-14 max-w-xl">
        <p className="eyebrow">Record checkoff</p>
        <form onSubmit={onCheckoff} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="check-member">Member</Label>
            <select
              id="check-member"
              className={selectClass}
              value={checkMemberId}
              onChange={(e) => setCheckMemberId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-cert">Certification</Label>
            <select
              id="check-cert"
              className={selectClass}
              value={checkCertId}
              onChange={(e) => setCheckCertId(e.target.value)}
            >
              {certs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending || !checkMemberId || !checkCertId}>
            Record checkoff
          </Button>
        </form>
      </section>

      <section className="mt-14 max-w-xl">
        <p className="eyebrow">Revoke</p>
        <form onSubmit={onRevoke} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="revoke-member">Member</Label>
            <select
              id="revoke-member"
              className={selectClass}
              value={revokeMemberId}
              onChange={(e) => setRevokeMemberId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="revoke-cert">Certification</Label>
            <select
              id="revoke-cert"
              className={selectClass}
              value={revokeCertId}
              onChange={(e) => setRevokeCertId(e.target.value)}
            >
              {certs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Reason</Label>
            <Input
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              required
              placeholder="Why this cert is being revoked"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={
              pending || !revokeMemberId || !revokeCertId || !revokeReason.trim()
            }
          >
            Revoke certification
          </Button>
        </form>
      </section>
    </AdminShell>
  );
}
