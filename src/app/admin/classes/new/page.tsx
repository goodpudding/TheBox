"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useData } from "@/components/providers";
import { ClassForm } from "@/app/admin/classes/class-form";
import type { Certification, ClassSessionInput, User } from "@/lib/data";

export default function AdminNewClassPage() {
  const router = useRouter();
  const { provider, bump } = useData();
  const [staff, setStaff] = useState<User[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [members, certifications] = await Promise.all([
        provider.adminListMembers(),
        provider.listCertifications(),
      ]);
      if (cancelled) return;
      setStaff(
        members.filter((u) => u.role === "staff" || u.role === "admin"),
      );
      setCerts(certifications);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  async function onSubmit(data: ClassSessionInput) {
    const session = await provider.adminUpsertClass(data);
    bump();
    router.push(`/admin/classes/${session.id}`);
  }

  return (
    <AdminShell
      title="New class"
      description="Create a published or draft session. Unpublished classes are hidden from the member catalog."
    >
      {!ready ? (
        <p className="text-secondary">Loading form…</p>
      ) : (
        <ClassForm
          staff={staff}
          certifications={certs}
          submitLabel="Create class"
          onSubmit={onSubmit}
        />
      )}
    </AdminShell>
  );
}
