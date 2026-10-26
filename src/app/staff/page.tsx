"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type { ContentPage, OrgSettings, Person } from "@/lib/data";

export default function StaffPage() {
  const { provider, revision } = useData();
  const [intro, setIntro] = useState<ContentPage | null>(null);
  const [staff, setStaff] = useState<Person[]>([]);
  const [instructors, setInstructors] = useState<Person[]>([]);
  const [settings, setSettings] = useState<OrgSettings | null>(null);

  useEffect(() => {
    void (async () => {
      setIntro(await provider.getContentBySlug("staff"));
      setStaff(await provider.listPeople("staff"));
      setInstructors(await provider.listPeople("instructor"));
      setSettings(await provider.getSettings());
    })();
  }, [provider, revision]);

  const contact = settings?.contactEmail ?? "thebox@discoverburien.org";

  return (
    <PageShell>
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <PageHero
          eyebrow="People"
          title="Staff & instructors"
          description="Who keeps The Box open, and who teaches on the calendar. A program of Discover Burien."
        />
        <div className="relative aspect-[16/10] overflow-hidden bg-brown/10 lg:mb-1">
          <Image
            src="/images/the-box-doors.jpg"
            alt="The Box entrance — orange Maker Space doors"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-center"
            priority
          />
        </div>
      </div>

      {intro ? (
        <div
          className="prose-cms mt-10 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: intro.html }}
        />
      ) : null}

      <PersonSection
        eyebrow="Shop & Discover Burien"
        title="Staff"
        people={staff}
      />

      <PersonSection
        eyebrow="Classes"
        title="Instructors"
        people={instructors}
      />

      <section className="mt-16 max-w-3xl">
        <p className="eyebrow">Teach here</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
          Pitch a class
        </h2>
        <p className="mt-3 leading-relaxed text-secondary">
          Instructors propose a plan; staff decide if it fits the shop. Classes
          and fees run through Discover Burien. Members can teach without a
          space-rental fee; students do not need a membership to take a class.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <a href={`mailto:${contact}`}>Email staff</a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/events">See the calendar</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/history">Read the history</Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}

function PersonSection({
  eyebrow,
  title,
  people,
}: {
  eyebrow: string;
  title: string;
  people: Person[];
}) {
  if (people.length === 0) return null;
  return (
    <section className="mt-14">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-brown">
        {title}
      </h2>
      <div className="mt-8 space-y-8">
        {people.map((person) => (
          <article key={person.id} className="max-w-3xl">
            <h3 className="font-display text-xl font-semibold text-brown">
              {person.name}
            </h3>
            <p className="mt-1 font-display text-sm font-semibold uppercase tracking-wider text-primary-text">
              {person.roleTitle}
            </p>
            <p className="mt-3 leading-relaxed text-charcoal">{person.bio}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
