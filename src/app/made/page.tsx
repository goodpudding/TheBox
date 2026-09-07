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
    </PageShell>
  );
}
