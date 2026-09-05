"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { ContentPage } from "@/lib/data";

export default function AdminContentPage() {
  const { provider, revision, bump } = useData();
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [pending, setPending] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    syncedAt: string;
    count: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setPages(await provider.adminListContentMappings());
    })();
  }, [provider, revision]);

  async function onSync() {
    setPending(true);
    setError(null);
    try {
      const result = await provider.adminSyncContent();
      setSyncResult(result);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Content mappings"
      description="Notion-synced pages (mock: local markdown stand-ins)."
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={() => void onSync()} disabled={pending}>
          {pending ? "Syncing…" : "Sync now"}
        </Button>
        {syncResult ? (
          <p className="text-sm text-secondary">
            Synced {syncResult.count} pages at{" "}
            {formatDateTime(syncResult.syncedAt)}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown">
          {error}
        </p>
      ) : null}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-display text-secondary">
              <th className="py-2 pr-3 font-medium">Slug</th>
              <th className="py-2 pr-3 font-medium">Title</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Version</th>
              <th className="py-2 pr-3 font-medium">Synced</th>
              <th className="py-2 font-medium">Notion id</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-b border-border/70">
                <td className="py-2.5 pr-3 font-mono text-xs text-charcoal">
                  {p.slug}
                </td>
                <td className="py-2.5 pr-3 font-display font-semibold text-brown">
                  {p.title}
                </td>
                <td className="py-2.5 pr-3">
                  <StatusPill tone="muted">{p.category}</StatusPill>
                </td>
                <td className="py-2.5 pr-3">{p.version}</td>
                <td className="py-2.5 pr-3 text-secondary">
                  {p.syncedAt ? formatDateTime(p.syncedAt) : "—"}
                </td>
                <td className="py-2.5 font-mono text-xs text-secondary">
                  {p.notionId ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages.length === 0 ? (
          <p className="mt-4 text-secondary">No content mappings.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
