"use client";

import { useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTier } from "@/lib/utils";
import type { MembershipTier, User, UserRole } from "@/lib/data";

const TIERS: MembershipTier[] = [
  "friend",
  "day",
  "community",
  "maker",
  "patron",
  "scholarship",
  "shop_steward",
  "household_addon",
  "maker_pro",
  "unlimited",
  "team",
];

const ROLE_LABEL: Record<UserRole, string> = {
  member: "Member",
  staff: "Staff (can use the admin screens)",
  admin: "Admin (can also change roles)",
};

const selectClass =
  "h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal";

/**
 * Membership, shop access, role and the staff note for one member. Zeffy
 * normally sets the membership when a payment arrives; this is for the cases
 * it cannot see, such as a comped membership or a new staff member.
 */
export function MemberAccessForm({ member }: { member: User }) {
  const { provider, currentUser, bump } = useData();
  const [tier, setTier] = useState<string>(member.tier ?? "");
  const [shopAccess, setShopAccess] = useState(member.shopAccess);
  const [role, setRole] = useState<UserRole>(member.role as UserRole);
  const [notes, setNotes] = useState(member._notes ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSetRole = currentUser?.role === "admin" && currentUser.id !== member.id;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await provider.adminUpdateMember(member.id, {
        tier: tier ? (tier as MembershipTier) : null,
        shopAccess,
        notes,
        role: canSetRole ? role : undefined,
      });
      setMessage("Saved.");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-8 max-w-xl space-y-5">
      <h2 className="font-display text-xl font-semibold text-brown">
        Membership and access
      </h2>
      <AdminNotice message={message} error={error} />
      <div className="space-y-2">
        <Label htmlFor="member-tier">Membership</Label>
        <select
          id="member-tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className={selectClass}
        >
          <option value="">None</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {formatTier(t)}
            </option>
          ))}
        </select>
        <p className="text-sm text-secondary">
          A Zeffy payment sets this by itself. Change it here for a membership Zeffy
          does not know about.
        </p>
      </div>
      <label className="flex items-center gap-3 text-charcoal">
        <input
          type="checkbox"
          className="size-5"
          checked={shopAccess}
          onChange={(e) => setShopAccess(e.target.checked)}
        />
        Can use the shop (machines, reservations, desks)
      </label>
      <div className="space-y-2">
        <Label htmlFor="member-role">Role</Label>
        <select
          id="member-role"
          value={role}
          disabled={!canSetRole}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={selectClass}
          aria-describedby="member-role-help"
        >
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <p id="member-role-help" className="text-sm text-secondary">
          {canSetRole
            ? "Staff and admins see every member’s details. Give this to people who need it."
            : currentUser?.id === member.id
              ? "You cannot change your own role. Ask another admin."
              : "Only an admin can change a role."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="member-notes">Staff note (the member never sees this)</Label>
        <Textarea
          id="member-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save membership and access"}
      </Button>
    </form>
  );
}
