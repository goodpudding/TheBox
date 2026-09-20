import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import {
  ProjectHighlights,
  SocialLinks,
} from "@/components/project-highlights";

export default function MadeHerePage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Community builds"
        title="Made at The Box"
        description="Projects from members learning, teaching, and making in Burien’s shop. Follow us on social for more — and share your own when you’re ready."
      />

      <div className="mt-8">
        <SocialLinks />
      </div>

      <div className="mt-12">
        <ProjectHighlights showHeading={false} />
      </div>

      <p className="mt-12 max-w-xl text-secondary leading-relaxed">
        Need something custom made for a shop or project?{" "}
        <Link href="/bounties#request" className="text-primary-text underline">
          Post a bounty
        </Link>{" "}
        — members claim requests and make them in the space.
      </p>
    </PageShell>
  );
}
