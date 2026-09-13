"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useData } from "@/components/providers";
import { ClassForm } from "@/app/admin/classes/class-form";
import type {
  Certification,
  ClassInterestBoardView,
  ClassSessionInput,
  User,
} from "@/lib/data";

function AdminNewClassInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interestBoardId = searchParams.get("interestBoardId");
  const { provider, currentUser, bump } = useData();
  const [staff, setStaff] = useState<User[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [board, setBoard] = useState<ClassInterestBoardView | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [members, certifications, interest] = await Promise.all([
        provider.adminListMembers(),
        provider.listCertifications(),
        interestBoardId
          ? provider.getInterestBoard(interestBoardId)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setStaff(
        members.filter(
          (u) => u.role === "staff" || u.role === "admin" || u.isTeacher,
        ),
      );
      setCerts(certifications);
      setBoard(interest);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, interestBoardId]);

  async function onSubmit(data: ClassSessionInput) {
    const session = await provider.adminUpsertClass(data);
    if (interestBoardId && currentUser) {
      await provider.adminLinkInterestBoardToClass(
        interestBoardId,
        session.id,
        currentUser.id,
      );
    }
    bump();
    router.push(`/admin/classes/${session.id}`);
  }

  const initial = board
    ? {
        title: board.title,
        category: board.category,
        instructorId: board.instructorHintUserId ?? undefined,
        capacity: Math.max(board.threshold, board.interestCount),
        published: true,
      }
    : null;

  return (
    <AdminShell
      title={board ? `Schedule: ${board.title}` : "New class"}
      description={
        board
          ? `From interest board (${board.interestCount} interested). After save, the interest list gets a 72-hour first-dibs booking window.`
          : "Create a published or draft session. Unpublished classes are hidden from the member catalog."
      }
    >
      {!ready ? (
        <p className="text-secondary">Loading form…</p>
      ) : (
        <ClassForm
          initial={initial}
          staff={staff}
          certifications={certs}
          submitLabel={board ? "Create & link interest list" : "Create class"}
          onSubmit={onSubmit}
        />
      )}
    </AdminShell>
  );
}

export default function AdminNewClassPage() {
  return (
    <Suspense
      fallback={
        <AdminShell title="New class" description="Loading…">
          <p className="text-secondary">Loading form…</p>
        </AdminShell>
      }
    >
      <AdminNewClassInner />
    </Suspense>
  );
}
