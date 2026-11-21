"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteInfo } from "@/lib/data";

/** Shop name, address, footer text and social links: what the footer shows. */
export function SiteDetailsForm() {
  const { provider, revision, bump } = useData();
  const [info, setInfo] = useState<SiteInfo | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.getSiteInfo().then((next) => {
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      setInfo(await provider.adminSaveSiteInfo(info));
      setMessage("Shop details saved.");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  if (!info) return null;
  const set = (patch: Partial<SiteInfo>) => setInfo({ ...info, ...patch });

  return (
    <section className="mt-16 max-w-xl border-t border-border pt-10">
      <h2 className="font-display text-xl font-semibold text-brown">Shop details</h2>
      <p className="mt-2 text-sm text-secondary">
        Shown at the bottom of every page and wherever the social links appear.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
        <AdminNotice message={message} error={error} />
        <div className="space-y-2">
          <Label htmlFor="site-name">Shop name</Label>
          <Input
            id="site-name"
            required
            value={info.orgName}
            onChange={(e) => set({ orgName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-address">Address line</Label>
          <Input
            id="site-address"
            value={info.addressLine}
            onChange={(e) => set({ addressLine: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-blurb">Footer text</Label>
          <Textarea
            id="site-blurb"
            rows={3}
            value={info.blurb}
            onChange={(e) => set({ blurb: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-instagram">Instagram link</Label>
          <Input
            id="site-instagram"
            type="url"
            required
            value={info.instagramUrl}
            onChange={(e) => set({ instagramUrl: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-facebook">Facebook link</Label>
          <Input
            id="site-facebook"
            type="url"
            required
            value={info.facebookUrl}
            onChange={(e) => set({ facebookUrl: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save shop details"}
        </Button>
      </form>
    </section>
  );
}
