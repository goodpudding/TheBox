"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { formatTier } from "@/lib/utils";
import type {
  AuditEvent,
  Badge,
  Booking,
  ClassSessionView,
  Machine,
  MembershipStatus,
  Reservation,
  UsageSession,
  User,
  UserCertificationView,
  WaiverSignature,
} from "@/lib/data";

const STATUSES: MembershipStatus[] = [
  "active",
  "lapsed",
  "suspended",
  "pending",
];

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function statusTone(
  status: MembershipStatus,
): "ok" | "warn" | "danger" | "info" | "muted" {
  if (status === "active") return "ok";
  if (status === "lapsed") return "warn";
  if (status === "suspended") return "danger";
  if (status === "pending") return "info";
  return "muted";
}

function certTone(
  status: UserCertificationView["status"],
): "ok" | "warn" | "danger" | "info" | "muted" {
  if (status === "certified") return "ok";
  if (status === "knowledge_passed") return "info";
  if (status === "expired") return "warn";
  if (status === "revoked") return "danger";
  return "muted";
}

export default function AdminMemberDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { provider, currentUser, revision, bump } = useData();

  const [member, setMember] = useState<User | null | undefined>(undefined);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [waivers, setWaivers] = useState<WaiverSignature[]>([]);
  const [certs, setCerts] = useState<UserCertificationView[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [classes, setClasses] = useState<ClassSessionView[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [usage, setUsage] = useState<UsageSession[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  const [status, setStatus] = useState<MembershipStatus>("pending");
  const [linkBadgeId, setLinkBadgeId] = useState("");
  const [linkUid, setLinkUid] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [
          m,
          linked,
          catalog,
          waiverRows,
          certRows,
          bookingRows,
          classRows,
          reservationRows,
          machineRows,
          usageRows,
          auditRows,
        ] = await Promise.all([
          provider.getMember(id),
          provider.listBadges(id),
          provider.adminListBadges(),
          provider.listWaiverHistory(id),
          provider.getCertifications(id),
          provider.listBookingsForUser(id),
          provider.listClasses({ upcomingOnly: false }),
          provider.listReservations({ userId: id }),
          provider.listMachines(),
          provider.getUsage(id),
          provider.adminListAuditEvents(id),
        ]);
        if (cancelled) return;
        setMember(m);
        if (m) setStatus(m.status);
        setBadges(linked);
        setAllBadges(catalog);
        setWaivers(waiverRows);
        setCerts(certRows);
        setBookings(bookingRows);
        setClasses(classRows);
        setReservations(reservationRows);
        setMachines(machineRows);
        setUsage(
          [...usageRows]
            .sort(
              (a, b) =>
                new Date(b.startedAt).getTime() -
                new Date(a.startedAt).getTime(),
            )
            .slice(0, 10),
        );
        setAudit(auditRows);
      } catch (err) {
        if (!cancelled) {
          setMember(null);
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, provider, revision]);

  const unlinkedBadges = useMemo(
    () => allBadges.filter((b) => b.userId == null),
    [allBadges],
  );

  const machineName = useMemo(() => {
    const map = Object.fromEntries(machines.map((m) => [m.id, m.name]));
    return (mid: string) => map[mid] ?? mid;
  }, [machines]);

  const classTitle = useMemo(() => {
    const map = Object.fromEntries(classes.map((c) => [c.id, c.title]));
    return (cid: string) => map[cid] ?? cid;
  }, [classes]);

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await provider.updateMemberProfile(member.id, {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        emergencyContactName: String(form.get("emergencyContactName") ?? ""),
        emergencyContactPhone: String(form.get("emergencyContactPhone") ?? ""),
        emergencyContactRelation: String(
          form.get("emergencyContactRelation") ?? "",
        ),
        newsletterOptIn: form.get("newsletterOptIn") === "on",
      });
      setMember(updated);
      bump();
      setMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setPending(false);
    }
  }

  async function onStatusChange(next: MembershipStatus) {
    if (!member || !currentUser) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await provider.adminUpdateMemberStatus(
        member.id,
        next,
        currentUser.id,
      );
      setMember(updated);
      setStatus(updated.status);
      bump();
      setMessage(`Status set to ${next}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setPending(false);
    }
  }

  async function linkBadgeById(badgeId: string) {
    if (!member || !currentUser || !badgeId) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminLinkBadge(badgeId, member.id, currentUser.id);
      setLinkBadgeId("");
      setLinkUid("");
      bump();
      setMessage("Badge linked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link badge");
    } finally {
      setPending(false);
    }
  }

  async function onLinkByUid(e: FormEvent) {
    e.preventDefault();
    const uid = linkUid.trim();
    if (!uid) return;
    const match = allBadges.find(
      (b) => b.uid.toLowerCase() === uid.toLowerCase(),
    );
    if (!match) {
      setError("No badge found with that UID.");
      return;
    }
    if (match.userId != null && match.userId !== member?.id) {
      setError("That badge is already linked to another member.");
      return;
    }
    if (match.userId === member?.id) {
      setMessage("Badge already linked to this member.");
      return;
    }
    await linkBadgeById(match.id);
  }

  async function onUnlink(badgeId: string) {
    if (!currentUser) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await provider.adminUnlinkBadge(badgeId, currentUser.id);
      bump();
      setMessage("Badge unlinked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink badge");
    } finally {
      setPending(false);
    }
  }

  if (member === undefined) {
    return (
      <AdminShell title="Member">
        <p className="text-secondary">Loading…</p>
      </AdminShell>
    );
  }

  if (!member) {
    return (
      <AdminShell title="Member not found">
        <p className="text-secondary">
          No member with that id.{" "}
          <Link
            href="/admin/members"
            className="font-display font-semibold text-primary-text hover:underline"
          >
            Back to members
          </Link>
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={member.displayName}
      description={`${member.email} · ${formatTier(member.tier)}`}
    >
      <p className="mb-6">
        <Link
          href="/admin/members"
          className="font-display text-sm font-semibold text-primary-text hover:underline"
        >
          ← All members
        </Link>
      </p>

      <div className="flex flex-wrap gap-2">
        <StatusPill tone={statusTone(member.status)}>{member.status}</StatusPill>
        <StatusPill tone="info">{member.role}</StatusPill>
        <StatusPill tone={member.shopAccess ? "ok" : "muted"}>
          {member.shopAccess ? "Shop access" : "No shop access"}
        </StatusPill>
        <StatusPill tone={member.newsletterOptIn ? "ok" : "muted"}>
          {member.newsletterOptIn ? "Newsletter" : "No newsletter"}
        </StatusPill>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 text-sm text-primary-text">{message}</p>
      ) : null}

      <section className="mt-12 max-w-xl">
        <p className="eyebrow">Membership status</p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="member-status">Status</Label>
          <select
            id="member-status"
            className={selectClass}
            value={status}
            disabled={pending || !currentUser}
            onChange={(e) =>
              void onStatusChange(e.target.value as MembershipStatus)
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-12 max-w-xl">
        <p className="eyebrow">Profile</p>
        <form onSubmit={onSaveProfile} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                defaultValue={member.firstName}
                key={`fn-${member.id}-${revision}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                required
                defaultValue={member.lastName}
                key={`ln-${member.id}-${revision}`}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={member.email} disabled readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={member.phone ?? ""}
              key={`ph-${member.id}-${revision}`}
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-charcoal">
            <input
              type="checkbox"
              name="newsletterOptIn"
              className="mt-1 h-4 w-4 rounded border-border accent-[var(--color-button)]"
              defaultChecked={member.newsletterOptIn}
              key={`newsletter-${member.id}-${revision}`}
            />
            <span>Send this member The Box newsletter.</span>
          </label>
          <p className="eyebrow pt-2">Emergency contact</p>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={member.emergencyContactName ?? ""}
              key={`en-${member.id}-${revision}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              defaultValue={member.emergencyContactPhone ?? ""}
              key={`ep-${member.id}-${revision}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactRelation">Relationship</Label>
            <Input
              id="emergencyContactRelation"
              name="emergencyContactRelation"
              defaultValue={member.emergencyContactRelation ?? ""}
              key={`er-${member.id}-${revision}`}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </section>

      <section className="mt-14 max-w-2xl">
        <p className="eyebrow">Badges</p>
        {badges.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {badges.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-display font-medium text-brown">
                    {b.label ?? "Badge"}
                  </p>
                  <p className="font-mono text-xs text-secondary">{b.uid}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={b.active ? "ok" : "danger"}>
                    {b.active ? "Active" : "Inactive"}
                  </StatusPill>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending || !currentUser}
                    onClick={() => void onUnlink(b.id)}
                  >
                    Unlink
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-secondary">No badges linked.</p>
        )}

        <div className="mt-6 space-y-6">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void linkBadgeById(linkBadgeId);
            }}
          >
            <Label htmlFor="link-badge">Link unlinked badge</Label>
            <select
              id="link-badge"
              className={selectClass}
              value={linkBadgeId}
              onChange={(e) => setLinkBadgeId(e.target.value)}
            >
              <option value="">Select a badge…</option>
              {unlinkedBadges.map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.label ?? "Badge") + " · " + b.uid}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !linkBadgeId || !currentUser}
            >
              Link selected
            </Button>
            {unlinkedBadges.length === 0 ? (
              <p className="text-sm text-secondary">No unlinked badges in catalog.</p>
            ) : null}
          </form>

          <form onSubmit={(e) => void onLinkByUid(e)} className="space-y-3">
            <Label htmlFor="link-uid">Or link by badge UID</Label>
            <Input
              id="link-uid"
              value={linkUid}
              onChange={(e) => setLinkUid(e.target.value)}
              placeholder="Badge UID"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending || !linkUid.trim() || !currentUser}
            >
              Link by UID
            </Button>
          </form>
        </div>
      </section>

      <HistorySection title="Waiver history">
        {waivers.length === 0 ? (
          <p className="text-secondary">No signatures on file.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {waivers.map((w) => (
              <li key={w.id} className="py-3">
                <p className="font-display font-medium text-brown">
                  Version {w.version}
                </p>
                <p className="text-sm text-secondary">
                  Signed {formatDateTime(w.signedAt)} as {w.fullNameTyped}
                </p>
              </li>
            ))}
          </ul>
        )}
      </HistorySection>

      <HistorySection title="Certifications">
        <ul className="divide-y divide-border border-y border-border">
          {certs.map((c) => (
            <li
              key={c.certificationId}
              className="flex flex-wrap items-start justify-between gap-2 py-3"
            >
              <div>
                <p className="font-display font-medium text-brown">
                  {c.certification.name}
                </p>
                <p className="text-sm text-secondary">
                  {c.checkedOffAt
                    ? `Checked off ${formatDateTime(c.checkedOffAt)}`
                    : c.knowledgePassedAt
                      ? `Knowledge ${formatDateTime(c.knowledgePassedAt)}`
                      : "Not started"}
                  {c.expiresAt ? ` · Expires ${formatDateTime(c.expiresAt)}` : ""}
                </p>
              </div>
              <StatusPill tone={certTone(c.status)}>
                {c.status.replace(/_/g, " ")}
              </StatusPill>
            </li>
          ))}
        </ul>
      </HistorySection>

      <HistorySection title="Bookings">
        {bookings.length === 0 ? (
          <p className="text-secondary">No class bookings.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <p className="font-display font-medium text-brown">
                  {classTitle(b.classSessionId)}
                </p>
                <StatusPill tone="muted">
                  {b.status.replace(/_/g, " ")}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </HistorySection>

      <HistorySection title="Reservations">
        {reservations.length === 0 ? (
          <p className="text-secondary">No machine reservations.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {reservations.map((r) => (
              <li key={r.id} className="py-3">
                <p className="font-display font-medium text-brown">
                  {machineName(r.machineId)}
                </p>
                <p className="text-sm text-secondary">
                  {formatDateTime(r.startsAt)} – {formatDateTime(r.endsAt)} ·{" "}
                  {r.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </HistorySection>

      <HistorySection title="Recent usage">
        {usage.length === 0 ? (
          <p className="text-secondary">No usage sessions.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {usage.map((u) => (
              <li key={u.id} className="py-3">
                <p className="font-display font-medium text-brown">
                  {machineName(u.machineId)}
                </p>
                <p className="text-sm text-secondary">
                  {formatDateTime(u.startedAt)}
                  {u.endedAt ? ` – ${formatDateTime(u.endedAt)}` : " · in progress"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </HistorySection>

      <HistorySection title="Audit">
        {audit.length === 0 ? (
          <p className="text-secondary">No audit events for this member.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {audit.map((a) => (
              <li key={a.id} className="py-3">
                <p className="font-display font-medium text-brown">
                  {a.action.replace(/_/g, " ")}
                </p>
                <p className="text-sm text-secondary">
                  {formatDateTime(a.occurredAt)} · {a.entityType} {a.entityId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </HistorySection>
    </AdminShell>
  );
}

function HistorySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14 max-w-2xl">
      <p className="eyebrow">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
