"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SHOP_LEAD_COMPLETED_TOOLS } from "@/lib/data";
import type {
  ContentPage,
  Machine,
  ToolChampionProgress,
  VolunteerRole,
} from "@/lib/data";

export default function VolunteerPage() {
  const { provider, currentUser, revision, bump } = useData();
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [roleContent, setRoleContent] = useState<Record<string, ContentPage>>(
    {},
  );
  const [volunteeringPolicy, setVolunteeringPolicy] =
    useState<ContentPage | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [progress, setProgress] = useState<ToolChampionProgress | null>(null);
  const [roleId, setRoleId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await provider.listVolunteerRoles();
      setRoles(list);
      const map: Record<string, ContentPage> = {};
      for (const role of list) {
        const page = await provider.getContentBySlug(role.contentSlug);
        if (page) map[role.id] = page;
      }
      setRoleContent(map);
      setVolunteeringPolicy(await provider.getContentBySlug("volunteering"));
      setMachines((await provider.listMachines()).filter((m) => m.active));
      if (currentUser) {
        setProgress(await provider.getToolChampionProgress(currentUser.id));
      } else {
        setProgress(null);
      }
    })();
  }, [provider, revision, currentUser]);

  const selectedRole = roles.find((r) => r.id === roleId);
  const isToolChampion = selectedRole?.slug === "tool-champion";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const message = String(form.get("message") ?? "");
      const machineId = String(form.get("machineId") ?? "");
      await provider.submitVolunteerInterest({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        roleId: String(form.get("roleId") ?? "") || null,
        message:
          isToolChampion && machineId
            ? `${message}\n\n[Requested machine: ${machineId}]`
            : message,
        userId: currentUser?.id ?? null,
      });
      if (isToolChampion && currentUser && machineId) {
        await provider.requestToolChampionTerm({
          userId: currentUser.id,
          machineId,
          notes: message || undefined,
        });
      }
      setSubmitted(true);
      bump();
      e.currentTarget.reset();
      setRoleId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <PageHero
          eyebrow="Get involved"
          title="Volunteer at The Box"
          description="Cover open hours as a Shop Steward, or champion a machine for two months. Three completed championships unlock the Shop lead track."
        />
        <div className="relative aspect-[16/10] overflow-hidden bg-brown/10 lg:mb-1">
          <Image
            src="/images/the-box-exterior.jpg"
            alt="Looking toward The Box from the surrounding parking area"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-[center_30%]"
            priority
          />
        </div>
      </div>

      {progress ? (
        <section className="mt-10 max-w-2xl border-l-4 border-primary bg-primary/10 px-5 py-4">
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary-text">
            Your Tool Champion progress
          </p>
          <p className="mt-2 font-display text-lg text-brown">
            {progress.completedCount} of {SHOP_LEAD_COMPLETED_TOOLS} machines
            completed
            {progress.shopLeadEligible
              ? " — you’re eligible for the Shop lead track."
              : "."}
          </p>
          {progress.canScheduleMaintenance ? (
            <p className="mt-2 text-sm text-secondary">
              You can{" "}
              <Link href="/maintenance" className="text-primary-text underline">
                schedule maintenance
              </Link>{" "}
              on machines you’re allowed to cover.
            </p>
          ) : null}
        </section>
      ) : null}

      {volunteeringPolicy ? (
        <div
          className="prose-cms mt-10 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: volunteeringPolicy.html }}
        />
      ) : null}

      <section className="mt-14">
        <p className="eyebrow">Open roles</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          Where help is needed
        </h2>
        <div className="mt-8 space-y-8">
          {roles.map((role) => (
            <article key={role.id} className="max-w-3xl">
              <h3 className="font-display text-xl font-semibold text-brown">
                {role.title}
              </h3>
              {roleContent[role.id] ? (
                <div
                  className="prose-cms mt-3"
                  dangerouslySetInnerHTML={{
                    __html: roleContent[role.id].html,
                  }}
                />
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 max-w-xl">
        <p className="eyebrow">Interest form</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          Say hello
        </h2>

        {submitted ? (
          <p className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-brown">
            Thanks — your interest is on the staff list
            {isToolChampion || roleId === "vr-tool-champion"
              ? " (and a Tool Champion request was queued if you were signed in)"
              : ""}
            . We&apos;ll be in touch.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={currentUser?.displayName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={currentUser?.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={currentUser?.phone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleId">Role of interest</Label>
              <select
                id="roleId"
                name="roleId"
                className="flex h-11 w-full rounded-full border border-border bg-surface px-4 font-serif text-base text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Any / not sure</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </div>
            {isToolChampion ? (
              <div className="space-y-2">
                <Label htmlFor="machineId">Machine to champion</Label>
                <select
                  id="machineId"
                  name="machineId"
                  required
                  className="flex h-11 w-full rounded-full border border-border bg-surface px-4 font-serif text-base text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a machine…
                  </option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {!currentUser ? (
                  <p className="text-sm text-secondary">
                    <Link href="/login" className="text-primary-text underline">
                      Sign in
                    </Link>{" "}
                    so we can attach the championship request to your account.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                required
                placeholder="Availability, skills, or questions…"
              />
            </div>
            {error ? (
              <p className="text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Submit interest"}
            </Button>
          </form>
        )}
      </section>
    </PageShell>
  );
}
