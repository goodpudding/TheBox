import { PageHero, PageShell } from "@/components/page-shell";
import { TextBlock } from "@/components/text-block";
import {
  ProjectHighlights,
  SocialLinks,
} from "@/components/project-highlights";

export default function MadeHerePage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Community builds"
        title="Made at the makerspace"
        description={<TextBlock slug="made-hero" as="span" />}
      />

      <div className="mt-8">
        <SocialLinks />
      </div>

      <div className="mt-12">
        <ProjectHighlights showHeading={false} />
      </div>

      <TextBlock
        slug="made-bounty"
        className="mt-12 max-w-xl text-secondary leading-relaxed"
      />
    </PageShell>
  );
}
