"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingProfilePage() {
  return (
    <MemberGate requireOnboardingComplete={false}>
      <ProfileForm />
    </MemberGate>
  );
}

function ProfileForm() {
  const { provider, currentUser, refreshUser, bump } = useData();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser) return;
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await provider.updateMemberProfile(currentUser.id, {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        emergencyContactName: String(form.get("emergencyContactName") ?? ""),
        emergencyContactPhone: String(form.get("emergencyContactPhone") ?? ""),
        emergencyContactRelation: String(
          form.get("emergencyContactRelation") ?? "",
        ),
      });
      await refreshUser();
      bump();
      const state = await provider.getOnboardingState(currentUser.id);
      router.push(
        state.nextStep
          ? `/onboarding/${state.nextStep}`
          : "/dashboard",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell className="max-w-xl">
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-secondary">
        Step 1 of 3
      </p>
      <PageHero
        eyebrow="Welcome"
        title="Your profile"
        description="We need a way to reach you and an emergency contact before you use the shop."
      />
      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              defaultValue={currentUser.firstName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              defaultValue={currentUser.lastName}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            defaultValue={currentUser.phone}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Emergency contact name</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            required
            defaultValue={currentUser.emergencyContactName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            required
            defaultValue={currentUser.emergencyContactPhone}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactRelation">Relationship</Label>
          <Input
            id="emergencyContactRelation"
            name="emergencyContactRelation"
            defaultValue={currentUser.emergencyContactRelation}
            placeholder="Parent, partner, friend…"
          />
        </div>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </form>
    </PageShell>
  );
}
