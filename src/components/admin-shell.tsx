"use client";

import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-nav";
import { PageShell } from "@/components/page-shell";
import { StaffGate } from "@/components/staff-gate";

export function AdminShell({
  title,
  eyebrow = "Admin",
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <StaffGate>
      <PageShell>
        <AdminNav />
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-brown sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-lg text-secondary leading-relaxed">
            {description}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </PageShell>
    </StaffGate>
  );
}
