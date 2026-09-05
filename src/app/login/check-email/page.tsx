import Link from "next/link";
import { PageHero, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export default function CheckEmailPage() {
  return (
    <PageShell className="max-w-lg">
      <PageHero
        eyebrow="Sign in"
        title="Check your email"
        description="We sent a magic link. It may take a minute. In Docker Compose, open Mailpit to read the message."
      />
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/login">Back to login</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="http://localhost:8025" target="_blank" rel="noreferrer">
            Open Mailpit
          </a>
        </Button>
      </div>
    </PageShell>
  );
}
