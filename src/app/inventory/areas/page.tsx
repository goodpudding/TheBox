"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { InventorySubnav } from "@/components/inventory-subnav";
import { AdminNotice } from "@/components/admin/admin-notice";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/components/providers";
import { isStaffRole } from "@/lib/data/access";
import type { AreaSteward, InventoryArea, User } from "@/lib/data";

export default function InventoryAreasPage() {
  return (
    <MemberGate>
      <AreasBody />
    </MemberGate>
  );
}

function AreasBody() {
  const { provider, currentUser, revision, bump } = useData();
  const [areas, setAreas] = useState<InventoryArea[]>([]);
  const [stewards, setStewards] = useState<AreaSteward[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staff = isStaffRole(currentUser);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    void Promise.all([
      provider.listInventoryAreas(),
      provider.listAreaStewards(),
      provider.adminListMembers(),
    ]).then(([areaList, stewardList, memberList]) => {
      if (cancelled) return;
      setAreas(areaList);
      setStewards(stewardList);
      setMembers(memberList);
      setNames(Object.fromEntries(areaList.map((a) => [a.id, a.name])));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision, staff]);

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.displayName ?? "Former member";

  async function run(done: string, action: () => Promise<unknown>) {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(done);
      bump();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function stewardIds(areaId: string): string[] {
    return stewards.filter((s) => s.areaId === areaId).map((s) => s.userId);
  }

  async function onAddArea(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !newName.trim()) return;
    const name = newName.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const ok = await run(`Added ${name}.`, () =>
      provider.upsertInventoryArea(currentUser.id, { slug, name }),
    );
    if (ok) setNewName("");
  }

  if (!staff) {
    return (
      <PageShell>
        <PageHero eyebrow="Inventory" title="Areas" description="Staff only." />
        <InventorySubnav />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Inventory"
        title="Areas and stewards"
        description="The areas an item can belong to, and the members who review and look after each one."
      />
      <InventorySubnav />
      <AdminNotice message={message} error={error} />

      <ul className="space-y-8">
        {areas.map((area) => {
          const ids = stewardIds(area.id);
          const candidates = members.filter(
            (m) => !ids.includes(m.id) && m.status === "active",
          );
          return (
            <li key={area.id} className="border-b border-border pb-8 last:border-0">
              <form
                className="flex max-w-xl flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!currentUser) return;
                  void run(`Saved ${names[area.id] ?? area.name}.`, () =>
                    provider.upsertInventoryArea(currentUser.id, {
                      id: area.id,
                      slug: area.slug,
                      name: names[area.id] ?? area.name,
                    }),
                  );
                }}
              >
                <div className="min-w-48 flex-1 space-y-2">
                  <Label htmlFor={`area-name-${area.id}`}>Area name</Label>
                  <Input
                    id={`area-name-${area.id}`}
                    required
                    value={names[area.id] ?? ""}
                    onChange={(e) =>
                      setNames((n) => ({ ...n, [area.id]: e.target.value }))
                    }
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                  Rename
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  aria-label={`${area.active ? "Switch off" : "Switch on"} ${area.name}`}
                  onClick={() => {
                    if (!currentUser) return;
                    void run(
                      area.active
                        ? `${area.name} switched off. Its items stay; new items cannot pick it.`
                        : `${area.name} switched on.`,
                      () =>
                        provider.upsertInventoryArea(currentUser.id, {
                          id: area.id,
                          slug: area.slug,
                          name: area.name,
                          active: !area.active,
                        }),
                    );
                  }}
                >
                  {area.active ? "Switch off" : "Switch on"}
                </Button>
                {area.active ? null : <StatusPill tone="muted">Switched off</StatusPill>}
              </form>

              <p className="mt-5 font-display text-sm font-medium text-brown">Stewards</p>
              {ids.length === 0 ? (
                <p className="mt-2 text-sm text-secondary">
                  Nobody yet. Staff review this area’s items.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {ids.map((userId) => (
                    <li
                      key={userId}
                      className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-4 pr-1 text-sm text-charcoal"
                    >
                      {memberName(userId)}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={`Remove ${memberName(userId)} from ${area.name}`}
                        onClick={() =>
                          void run(
                            `${memberName(userId)} no longer stewards ${area.name}.`,
                            () =>
                              provider.adminSetAreaStewards(
                                area.id,
                                ids.filter((id) => id !== userId),
                              ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-3 flex max-w-xl flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const userId = picks[area.id];
                  if (!userId) return;
                  void run(`${memberName(userId)} now stewards ${area.name}.`, () =>
                    provider.adminSetAreaStewards(area.id, [...ids, userId]),
                  ).then((ok) => {
                    if (ok) setPicks((p) => ({ ...p, [area.id]: "" }));
                  });
                }}
              >
                <div className="min-w-48 flex-1 space-y-2">
                  <Label htmlFor={`area-steward-${area.id}`}>Add a steward</Label>
                  <select
                    id={`area-steward-${area.id}`}
                    value={picks[area.id] ?? ""}
                    onChange={(e) =>
                      setPicks((p) => ({ ...p, [area.id]: e.target.value }))
                    }
                    className="h-11 w-full rounded-full border border-border bg-surface px-4 text-charcoal"
                  >
                    <option value="">Choose a member…</option>
                    {candidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm" disabled={pending || !picks[area.id]}>
                  Add steward
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
      {areas.length === 0 ? <p className="text-secondary">No areas yet.</p> : null}

      <form
        onSubmit={(e) => void onAddArea(e)}
        className="mt-10 flex max-w-xl flex-wrap items-end gap-3 border-t border-border pt-8"
      >
        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor="area-new">New area</Label>
          <Input
            id="area-new"
            value={newName}
            placeholder="Ceramics"
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending || !newName.trim()}>
          Add area
        </Button>
      </form>
    </PageShell>
  );
}
