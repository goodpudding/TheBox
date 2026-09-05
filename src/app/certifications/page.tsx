"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MemberGate } from "@/components/member-gate";
import { PageHero, PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { formatDateTime } from "@/lib/format";
import type { UserCertificationView } from "@/lib/data";

const STATUS_COPY: Record<
  UserCertificationView["status"],
  { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info"; path: string }
> = {
  not_started: {
    label: "Not started",
    tone: "muted",
    path: "Complete the linked learning module, pass the knowledge quiz, then book a hands-on checkoff (unless knowledge-only).",
  },
  knowledge_passed: {
    label: "Knowledge passed — needs checkoff",
    tone: "info",
    path: "Book a certification checkoff session with staff. A quiz alone never grants machine access.",
  },
  certified: {
    label: "Certified",
    tone: "ok",
    path: "You’re cleared for machines that require this cert (while membership, waiver, and badge are valid).",
  },
  expired: {
    label: "Expired",
    tone: "warn",
    path: "Retake the knowledge path if required, then schedule a refresher checkoff with staff.",
  },
  revoked: {
    label: "Revoked",
    tone: "danger",
    path: "Talk with staff about what is needed to regain this certification.",
  },
};

export default function CertificationsPage() {
  return (
    <MemberGate>
      <CertificationsBody />
    </MemberGate>
  );
}

function CertificationsBody() {
  const { provider, currentUser, revision } = useData();
  const [rows, setRows] = useState<UserCertificationView[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    void provider.getCertifications(currentUser.id).then(setRows);
  }, [currentUser, provider, revision]);

  if (!currentUser) return null;

  return (
    <PageShell>
      <PageHero
        eyebrow="Certifications"
        title="What you’re cleared for"
        description="Every machine requires Shop Orientation plus its area cert. Certified always means knowledge test and hands-on checkoff — except knowledge-only certs like Shop Orientation."
      />

      <ul className="mt-12 divide-y divide-border border-y border-border">
        {rows.map((row) => {
          const copy = STATUS_COPY[row.status];
          return (
            <li key={row.certificationId} className="py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-brown">
                    {row.certification.name}
                  </h2>
                  {row.certification.knowledgeOnly ? (
                    <p className="mt-1 font-display text-xs uppercase tracking-wider text-primary-text">
                      Knowledge-only
                    </p>
                  ) : null}
                </div>
                <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
              </div>
              <p className="mt-3 max-w-2xl text-secondary leading-relaxed">
                {row.certification.description}
              </p>
              <p className="mt-3 max-w-2xl text-sm text-charcoal leading-relaxed">
                <span className="font-display font-semibold text-brown">
                  Path:{" "}
                </span>
                {copy.path}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
                {row.knowledgePassedAt ? (
                  <span>
                    Knowledge {formatDateTime(row.knowledgePassedAt)}
                  </span>
                ) : null}
                {row.checkedOffAt ? (
                  <span>Checkoff {formatDateTime(row.checkedOffAt)}</span>
                ) : null}
                {row.expiresAt ? (
                  <span>Expires {formatDateTime(row.expiresAt)}</span>
                ) : null}
                {row.revokedAt ? (
                  <span>Revoked {formatDateTime(row.revokedAt)}</span>
                ) : null}
              </div>
              {(row.status === "not_started" ||
                row.status === "knowledge_passed") && (
                <p className="mt-4">
                  <Link
                    href="/learn"
                    className="font-display text-sm font-semibold text-primary-text hover:underline"
                  >
                    {row.status === "not_started"
                      ? "Go to learning modules →"
                      : "Learning complete — ask staff about checkoffs →"}
                  </Link>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
