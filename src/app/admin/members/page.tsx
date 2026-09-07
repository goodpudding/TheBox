"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTier } from "@/lib/utils";
import type { MembershipStatus, User } from "@/lib/data";

function statusTone(
  status: MembershipStatus,
): "ok" | "warn" | "danger" | "info" | "muted" {
  if (status === "active") return "ok";
  if (status === "lapsed") return "warn";
  if (status === "suspended") return "danger";
  if (status === "pending") return "info";
  return "muted";
}

export default function AdminMembersPage() {
  const { provider, revision } = useData();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void provider.adminListMembers(query).then((rows) => {
      if (!cancelled) {
        setMembers(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision, query]);

  return (
    <AdminShell
      title="Members"
      description="Search members, open a profile, and manage status, badges, and certifications."
    >
      <div className="max-w-md space-y-2">
        <Label htmlFor="member-search">Search</Label>
        <Input
          id="member-search"
          type="search"
          placeholder="Name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        {loading ? (
          <p className="text-secondary">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-secondary">No members match that search.</p>
        ) : (
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border font-display text-xs uppercase tracking-wider text-secondary">
                <th className="py-3 pr-4 font-semibold">Name</th>
                <th className="py-3 pr-4 font-semibold">Email</th>
                <th className="py-3 pr-4 font-semibold">Role</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Tier</th>
                <th className="py-3 font-semibold">Newsletter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="font-display font-semibold text-brown hover:underline"
                    >
                      {m.displayName}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-secondary">{m.email}</td>
                  <td className="py-3 pr-4 capitalize text-charcoal">{m.role}</td>
                  <td className="py-3 pr-4">
                    <StatusPill tone={statusTone(m.status)}>{m.status}</StatusPill>
                  </td>
                  <td className="py-3 pr-4 text-charcoal">{formatTier(m.tier)}</td>
                  <td className="py-3 text-charcoal">
                    {m.newsletterOptIn ? "Opted in" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
