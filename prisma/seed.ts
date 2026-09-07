/**
 * Seed the database from data/mock/*.json fixtures.
 * Usage: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const mockDir = join(process.cwd(), "data", "mock");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(mockDir, name), "utf8")) as T;
}

function asDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(iso);
}

function jsonArr(value: unknown): string {
  return JSON.stringify(value ?? []);
}

async function main() {
  console.log("Seeding from data/mock…");

  // Order matters for FKs
  const users = readJson<Array<Record<string, unknown>>>("users.json");
  // First pass without household links
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: String(u.id) },
      create: {
        id: String(u.id),
        email: String(u.email),
        firstName: String(u.firstName),
        lastName: String(u.lastName),
        displayName: String(u.displayName),
        phone: (u.phone as string) ?? null,
        role: String(u.role),
        status: String(u.status),
        tier: (u.tier as string) ?? null,
        billingInterval: (u.billingInterval as string) ?? null,
        shopAccess: Boolean(u.shopAccess ?? true),
        dayPassCreditExpiresAt: asDate(u.dayPassCreditExpiresAt as string),
        scholarshipExpiresAt: asDate(u.scholarshipExpiresAt as string),
        emergencyContactName: (u.emergencyContactName as string) ?? null,
        emergencyContactPhone: (u.emergencyContactPhone as string) ?? null,
        emergencyContactRelation: (u.emergencyContactRelation as string) ?? null,
        newsletterOptIn: Boolean(u.newsletterOptIn),
        profileComplete: Boolean(u.profileComplete),
        notes: (u._notes as string) ?? null,
        createdAt: asDate(u.createdAt as string) ?? new Date(),
        updatedAt: asDate(u.updatedAt as string) ?? new Date(),
      },
      update: {
        email: String(u.email),
        firstName: String(u.firstName),
        lastName: String(u.lastName),
        displayName: String(u.displayName),
        phone: (u.phone as string) ?? null,
        role: String(u.role),
        status: String(u.status),
        tier: (u.tier as string) ?? null,
        billingInterval: (u.billingInterval as string) ?? null,
        shopAccess: Boolean(u.shopAccess ?? true),
        newsletterOptIn: Boolean(u.newsletterOptIn),
        profileComplete: Boolean(u.profileComplete),
        notes: (u._notes as string) ?? null,
      },
    });
  }
  // Second pass: household links
  for (const u of users) {
    if (u.householdPrimaryUserId) {
      await prisma.user.update({
        where: { id: String(u.id) },
        data: { householdPrimaryUserId: String(u.householdPrimaryUserId) },
      });
    }
  }

  const certifications = readJson<Array<Record<string, unknown>>>("certifications.json");
  for (const c of certifications) {
    await prisma.certification.upsert({
      where: { id: String(c.id) },
      create: {
        id: String(c.id),
        slug: String(c.slug),
        name: String(c.name),
        description: String(c.description),
        knowledgeOnly: Boolean(c.knowledgeOnly),
        requiresCertificationIds: jsonArr(c.requiresCertificationIds),
        expiryMonths: (c.expiryMonths as number) ?? null,
        sortOrder: Number(c.sortOrder ?? 0),
        active: Boolean(c.active ?? true),
        createdAt: asDate(c.createdAt as string) ?? new Date(),
        updatedAt: asDate(c.updatedAt as string) ?? new Date(),
      },
      update: {
        name: String(c.name),
        description: String(c.description),
        knowledgeOnly: Boolean(c.knowledgeOnly),
        requiresCertificationIds: jsonArr(c.requiresCertificationIds),
        expiryMonths: (c.expiryMonths as number) ?? null,
        sortOrder: Number(c.sortOrder ?? 0),
        active: Boolean(c.active ?? true),
      },
    });
  }

  const badges = readJson<Array<Record<string, unknown>>>("badges.json");
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { id: String(b.id) },
      create: {
        id: String(b.id),
        uid: String(b.uid),
        label: (b.label as string) ?? null,
        userId: (b.userId as string) ?? null,
        active: Boolean(b.active ?? true),
        createdAt: asDate(b.createdAt as string) ?? new Date(),
        updatedAt: asDate(b.updatedAt as string) ?? new Date(),
      },
      update: {
        uid: String(b.uid),
        label: (b.label as string) ?? null,
        userId: (b.userId as string) ?? null,
        active: Boolean(b.active ?? true),
      },
    });
  }

  const machines = readJson<Array<Record<string, unknown>>>("machines.json");
  for (const m of machines) {
    await prisma.machine.upsert({
      where: { id: String(m.id) },
      create: {
        id: String(m.id),
        name: String(m.name),
        area: String(m.area),
        requiredCertificationIds: jsonArr(m.requiredCertificationIds),
        readerKey: String(m.readerKey),
        active: Boolean(m.active ?? true),
        reservationRecommended: Boolean(m.reservationRecommended),
        reservationRequired: Boolean(m.reservationRequired),
        locationLabel: String(m.locationLabel ?? ""),
        gettingStartedVideoUrl:
          m.gettingStartedVideoUrl == null
            ? null
            : String(m.gettingStartedVideoUrl),
        sortOrder: Number(m.sortOrder ?? 0),
        createdAt: asDate(m.createdAt as string) ?? new Date(),
        updatedAt: asDate(m.updatedAt as string) ?? new Date(),
      },
      update: {
        name: String(m.name),
        area: String(m.area),
        requiredCertificationIds: jsonArr(m.requiredCertificationIds),
        readerKey: String(m.readerKey),
        active: Boolean(m.active ?? true),
        reservationRecommended: Boolean(m.reservationRecommended),
        reservationRequired: Boolean(m.reservationRequired),
        locationLabel: String(m.locationLabel ?? ""),
        gettingStartedVideoUrl:
          m.gettingStartedVideoUrl == null
            ? null
            : String(m.gettingStartedVideoUrl),
        sortOrder: Number(m.sortOrder ?? 0),
      },
    });
  }

  const userCerts = readJson<Array<Record<string, unknown>>>("user-certifications.json");
  for (const uc of userCerts) {
    await prisma.userCertification.upsert({
      where: { id: String(uc.id) },
      create: {
        id: String(uc.id),
        userId: String(uc.userId),
        certificationId: String(uc.certificationId),
        status: String(uc.status),
        knowledgePassedAt: asDate(uc.knowledgePassedAt as string),
        checkedOffAt: asDate(uc.checkedOffAt as string),
        checkedOffById: (uc.checkedOffById as string) ?? null,
        expiresAt: asDate(uc.expiresAt as string),
        revokedAt: asDate(uc.revokedAt as string),
        revokedById: (uc.revokedById as string) ?? null,
        revokeReason: (uc.revokeReason as string) ?? null,
        createdAt: asDate(uc.createdAt as string) ?? new Date(),
        updatedAt: asDate(uc.updatedAt as string) ?? new Date(),
      },
      update: {
        status: String(uc.status),
        knowledgePassedAt: asDate(uc.knowledgePassedAt as string),
        checkedOffAt: asDate(uc.checkedOffAt as string),
        checkedOffById: (uc.checkedOffById as string) ?? null,
        expiresAt: asDate(uc.expiresAt as string),
        revokedAt: asDate(uc.revokedAt as string),
        revokedById: (uc.revokedById as string) ?? null,
        revokeReason: (uc.revokeReason as string) ?? null,
      },
    });
  }

  const contentPages = readJson<Array<Record<string, unknown>>>("content-pages.json");
  for (const p of contentPages) {
    await prisma.contentPage.upsert({
      where: { id: String(p.id) },
      create: {
        id: String(p.id),
        notionId: (p.notionId as string) ?? null,
        slug: String(p.slug),
        title: String(p.title),
        html: String(p.html ?? ""),
        markdownPath: (p.markdownPath as string) ?? null,
        category: String(p.category),
        version: String(p.version ?? "1"),
        syncedAt: asDate(p.syncedAt as string),
        published: Boolean(p.published ?? true),
        createdAt: asDate(p.createdAt as string) ?? new Date(),
        updatedAt: asDate(p.updatedAt as string) ?? new Date(),
      },
      update: {
        title: String(p.title),
        html: String(p.html ?? ""),
        markdownPath: (p.markdownPath as string) ?? null,
        category: String(p.category),
        version: String(p.version ?? "1"),
        published: Boolean(p.published ?? true),
      },
    });
  }

  const settings = readJson<Record<string, unknown>>("settings.json");
  await prisma.orgSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      orgName: String(settings.orgName),
      paymentUrl: String(settings.paymentUrl),
      donationUrl: String(settings.donationUrl),
      scholarshipDonationUrl: String(settings.scholarshipDonationUrl),
      contactEmail: String(settings.contactEmail),
      hoursContentSlug: String(settings.hoursContentSlug),
      currentWaiverVersion: String(settings.currentWaiverVersion),
      memberExpectationsPolicySlug: String(settings.memberExpectationsPolicySlug),
      quizPassThresholdPercent: Number(settings.quizPassThresholdPercent),
      quizAttemptLimit: Number(settings.quizAttemptLimit),
      quizQuestionCount: Number(settings.quizQuestionCount),
      classCancellationCutoffHours: Number(settings.classCancellationCutoffHours),
      paymentHoldHours: Number(settings.paymentHoldHours),
      reservationHorizonDays: Number(settings.reservationHorizonDays),
      maxHoursPerDay: Number(settings.maxHoursPerDay),
      maxOpenReservations: Number(settings.maxOpenReservations),
      reservationSlotMinutes: Number(settings.reservationSlotMinutes),
      communitySeatCap: Number(settings.communitySeatCap),
      makerMonthlyCents: Number(settings.makerMonthlyCents),
      patronScholarshipSurchargeCents: Number(settings.patronScholarshipSurchargeCents),
      scholarshipFundBalanceCents: Number(settings.scholarshipFundBalanceCents),
      scholarshipSeatsAwarded: Number(settings.scholarshipSeatsAwarded),
      showPhase3Tiers: Boolean(settings.showPhase3Tiers),
    },
    update: {
      orgName: String(settings.orgName),
      paymentUrl: String(settings.paymentUrl),
      donationUrl: String(settings.donationUrl),
      scholarshipDonationUrl: String(settings.scholarshipDonationUrl),
      contactEmail: String(settings.contactEmail),
      currentWaiverVersion: String(settings.currentWaiverVersion),
      scholarshipFundBalanceCents: Number(settings.scholarshipFundBalanceCents),
      scholarshipSeatsAwarded: Number(settings.scholarshipSeatsAwarded),
    },
  });

  const products = readJson<Array<Record<string, unknown>>>("membership-products.json");
  for (const p of products) {
    await prisma.membershipProduct.upsert({
      where: { id: String(p.id) },
      create: {
        id: String(p.id),
        tier: String(p.tier),
        name: String(p.name),
        summary: String(p.summary),
        priceCents: Number(p.priceCents),
        billingInterval: String(p.billingInterval),
        annualPriceCents: (p.annualPriceCents as number) ?? null,
        shopAccess: Boolean(p.shopAccess),
        phase: Number(p.phase),
        visibleOnJoin: Boolean(p.visibleOnJoin),
        joinable: Boolean(p.joinable),
        highlight: Boolean(p.highlight),
        sortOrder: Number(p.sortOrder),
        isAddOn: Boolean(p.isAddOn),
        cappedSeats: (p.cappedSeats as number) ?? null,
        createdAt: asDate(p.createdAt as string) ?? new Date(),
        updatedAt: asDate(p.updatedAt as string) ?? new Date(),
      },
      update: {
        name: String(p.name),
        summary: String(p.summary),
        priceCents: Number(p.priceCents),
        visibleOnJoin: Boolean(p.visibleOnJoin),
        joinable: Boolean(p.joinable),
      },
    });
  }

  // Remaining entities — bulk upsert helpers
  async function seedSimple(
    file: string,
    upsert: (row: Record<string, unknown>) => Promise<unknown>,
  ) {
    const rows = readJson<Array<Record<string, unknown>>>(file);
    for (const row of rows) await upsert(row);
    console.log(`  ${file}: ${rows.length}`);
  }

  await seedSimple("waiver-signatures.json", (w) =>
    prisma.waiverSignature.upsert({
      where: { id: String(w.id) },
      create: {
        id: String(w.id),
        userId: String(w.userId),
        version: String(w.version),
        signedAt: asDate(w.signedAt as string)!,
        fullNameTyped: String(w.fullNameTyped),
        ip: String(w.ip),
        userAgent: (w.userAgent as string) ?? null,
        createdAt: asDate(w.createdAt as string) ?? new Date(),
        updatedAt: asDate(w.updatedAt as string) ?? new Date(),
      },
      update: { version: String(w.version) },
    }),
  );

  await seedSimple("policy-acknowledgements.json", (a) =>
    prisma.policyAcknowledgement.upsert({
      where: { id: String(a.id) },
      create: {
        id: String(a.id),
        userId: String(a.userId),
        policySlug: String(a.policySlug),
        version: String(a.version),
        acknowledgedAt: asDate(a.acknowledgedAt as string)!,
        createdAt: asDate(a.createdAt as string) ?? new Date(),
        updatedAt: asDate(a.updatedAt as string) ?? new Date(),
      },
      update: { version: String(a.version) },
    }),
  );

  await seedSimple("class-sessions.json", (c) =>
    prisma.classSession.upsert({
      where: { id: String(c.id) },
      create: {
        id: String(c.id),
        title: String(c.title),
        slug: String(c.slug),
        descriptionSlug: String(c.descriptionSlug),
        category: String(c.category),
        instructorId: String(c.instructorId),
        startsAt: asDate(c.startsAt as string)!,
        endsAt: asDate(c.endsAt as string)!,
        capacity: Number(c.capacity),
        priceCents: Number(c.priceCents),
        zeffyUrl: (c.zeffyUrl as string) ?? null,
        prerequisiteCertificationIds: jsonArr(c.prerequisiteCertificationIds),
        location: String(c.location),
        cancellationCutoffHours: (c.cancellationCutoffHours as number) ?? null,
        published: Boolean(c.published),
        createdAt: asDate(c.createdAt as string) ?? new Date(),
        updatedAt: asDate(c.updatedAt as string) ?? new Date(),
      },
      update: {
        title: String(c.title),
        capacity: Number(c.capacity),
        priceCents: Number(c.priceCents),
        published: Boolean(c.published),
      },
    }),
  );

  await seedSimple("bookings.json", (b) =>
    prisma.booking.upsert({
      where: { id: String(b.id) },
      create: {
        id: String(b.id),
        classSessionId: String(b.classSessionId),
        userId: String(b.userId),
        status: String(b.status),
        waitlistPosition: (b.waitlistPosition as number) ?? null,
        paidAt: asDate(b.paidAt as string),
        paidMarkedById: (b.paidMarkedById as string) ?? null,
        paymentHoldExpiresAt: asDate(b.paymentHoldExpiresAt as string),
        cancelledAt: asDate(b.cancelledAt as string),
        attendedAt: asDate(b.attendedAt as string),
        createdAt: asDate(b.createdAt as string) ?? new Date(),
        updatedAt: asDate(b.updatedAt as string) ?? new Date(),
      },
      update: { status: String(b.status) },
    }),
  );

  await seedSimple("reservations.json", (r) =>
    prisma.reservation.upsert({
      where: { id: String(r.id) },
      create: {
        id: String(r.id),
        userId: String(r.userId),
        machineId: String(r.machineId),
        startsAt: asDate(r.startsAt as string)!,
        endsAt: asDate(r.endsAt as string)!,
        status: String(r.status),
        createdById: String(r.createdById),
        cancelledAt: asDate(r.cancelledAt as string),
        cancelReason: (r.cancelReason as string) ?? null,
        createdAt: asDate(r.createdAt as string) ?? new Date(),
        updatedAt: asDate(r.updatedAt as string) ?? new Date(),
      },
      update: { status: String(r.status) },
    }),
  );

  await seedSimple("maintenance-blocks.json", (m) =>
    prisma.maintenanceBlock.upsert({
      where: { id: String(m.id) },
      create: {
        id: String(m.id),
        machineId: String(m.machineId),
        startsAt: asDate(m.startsAt as string)!,
        endsAt: asDate(m.endsAt as string)!,
        reason: String(m.reason),
        createdById: String(m.createdById),
        createdAt: asDate(m.createdAt as string) ?? new Date(),
        updatedAt: asDate(m.updatedAt as string) ?? new Date(),
      },
      update: { reason: String(m.reason) },
    }),
  );

  await seedSimple("learning-modules.json", (m) =>
    prisma.learningModule.upsert({
      where: { id: String(m.id) },
      create: {
        id: String(m.id),
        slug: String(m.slug),
        title: String(m.title),
        summary: String(m.summary),
        certificationId: String(m.certificationId),
        knowledgeOnly: Boolean(m.knowledgeOnly),
        published: Boolean(m.published),
        passThresholdPercent: Number(m.passThresholdPercent),
        attemptLimit: Number(m.attemptLimit),
        sortOrder: Number(m.sortOrder),
        createdAt: asDate(m.createdAt as string) ?? new Date(),
        updatedAt: asDate(m.updatedAt as string) ?? new Date(),
      },
      update: {
        title: String(m.title),
        published: Boolean(m.published),
      },
    }),
  );

  await seedSimple("lessons.json", (l) =>
    prisma.lesson.upsert({
      where: { id: String(l.id) },
      create: {
        id: String(l.id),
        moduleId: String(l.moduleId),
        slug: String(l.slug),
        title: String(l.title),
        contentSlug: String(l.contentSlug),
        sortOrder: Number(l.sortOrder),
        estimatedMinutes: Number(l.estimatedMinutes),
        createdAt: asDate(l.createdAt as string) ?? new Date(),
        updatedAt: asDate(l.updatedAt as string) ?? new Date(),
      },
      update: { title: String(l.title), contentSlug: String(l.contentSlug) },
    }),
  );

  await seedSimple("questions.json", (q) =>
    prisma.question.upsert({
      where: { id: String(q.id) },
      create: {
        id: String(q.id),
        moduleId: String(q.moduleId),
        prompt: String(q.prompt),
        choices: jsonArr(q.choices),
        correctIndex: Number(q.correctIndex),
        explanation: (q.explanation as string) ?? null,
        active: Boolean(q.active ?? true),
        createdAt: asDate(q.createdAt as string) ?? new Date(),
        updatedAt: asDate(q.updatedAt as string) ?? new Date(),
      },
      update: {
        prompt: String(q.prompt),
        choices: jsonArr(q.choices),
        correctIndex: Number(q.correctIndex),
        active: Boolean(q.active ?? true),
      },
    }),
  );

  await seedSimple("lesson-progress.json", (p) =>
    prisma.lessonProgress.upsert({
      where: { id: String(p.id) },
      create: {
        id: String(p.id),
        userId: String(p.userId),
        lessonId: String(p.lessonId),
        completedAt: asDate(p.completedAt as string)!,
        createdAt: asDate(p.createdAt as string) ?? new Date(),
        updatedAt: asDate(p.updatedAt as string) ?? new Date(),
      },
      update: { completedAt: asDate(p.completedAt as string)! },
    }),
  );

  await seedSimple("quiz-attempts.json", (a) =>
    prisma.quizAttempt.upsert({
      where: { id: String(a.id) },
      create: {
        id: String(a.id),
        userId: String(a.userId),
        moduleId: String(a.moduleId),
        questionIds: jsonArr(a.questionIds),
        answers: jsonArr(a.answers),
        scorePercent: Number(a.scorePercent),
        passed: Boolean(a.passed),
        startedAt: asDate(a.startedAt as string)!,
        submittedAt: asDate(a.submittedAt as string)!,
        createdAt: asDate(a.createdAt as string) ?? new Date(),
        updatedAt: asDate(a.updatedAt as string) ?? new Date(),
      },
      update: { scorePercent: Number(a.scorePercent), passed: Boolean(a.passed) },
    }),
  );

  await seedSimple("volunteer-roles.json", (r) =>
    prisma.volunteerRole.upsert({
      where: { id: String(r.id) },
      create: {
        id: String(r.id),
        slug: String(r.slug),
        title: String(r.title),
        contentSlug: String(r.contentSlug),
        active: Boolean(r.active),
        sortOrder: Number(r.sortOrder),
        createdAt: asDate(r.createdAt as string) ?? new Date(),
        updatedAt: asDate(r.updatedAt as string) ?? new Date(),
      },
      update: { title: String(r.title), active: Boolean(r.active) },
    }),
  );

  await seedSimple("volunteer-interests.json", (v) =>
    prisma.volunteerInterest.upsert({
      where: { id: String(v.id) },
      create: {
        id: String(v.id),
        name: String(v.name),
        email: String(v.email),
        phone: (v.phone as string) ?? null,
        roleId: (v.roleId as string) ?? null,
        message: String(v.message),
        status: String(v.status),
        userId: (v.userId as string) ?? null,
        reviewedById: (v.reviewedById as string) ?? null,
        reviewedAt: asDate(v.reviewedAt as string),
        notes: (v.notes as string) ?? null,
        createdAt: asDate(v.createdAt as string) ?? new Date(),
        updatedAt: asDate(v.updatedAt as string) ?? new Date(),
      },
      update: { status: String(v.status), notes: (v.notes as string) ?? null },
    }),
  );

  await seedSimple("usage-sessions.json", (s) =>
    prisma.usageSession.upsert({
      where: { id: String(s.id) },
      create: {
        id: String(s.id),
        userId: String(s.userId),
        machineId: String(s.machineId),
        badgeId: String(s.badgeId),
        startedAt: asDate(s.startedAt as string)!,
        endedAt: asDate(s.endedAt as string),
        reservationId: (s.reservationId as string) ?? null,
        endedBy: String(s.endedBy),
        createdAt: asDate(s.createdAt as string) ?? new Date(),
        updatedAt: asDate(s.updatedAt as string) ?? new Date(),
      },
      update: { endedAt: asDate(s.endedAt as string) },
    }),
  );

  await seedSimple("access-logs.json", (l) =>
    prisma.accessLog.upsert({
      where: { id: String(l.id) },
      create: {
        id: String(l.id),
        readerKey: String(l.readerKey),
        machineId: (l.machineId as string) ?? null,
        badgeUid: String(l.badgeUid),
        userId: (l.userId as string) ?? null,
        allow: Boolean(l.allow),
        reason: (l.reason as string) ?? null,
        reservationNotice: (l.reservationNotice as string) ?? null,
        sessionId: (l.sessionId as string) ?? null,
        requestedAt: asDate(l.requestedAt as string)!,
        createdAt: asDate(l.createdAt as string) ?? new Date(),
        updatedAt: asDate(l.updatedAt as string) ?? new Date(),
      },
      update: { allow: Boolean(l.allow), reason: (l.reason as string) ?? null },
    }),
  );

  await seedSimple("audit-events.json", (e) =>
    prisma.auditEvent.upsert({
      where: { id: String(e.id) },
      create: {
        id: String(e.id),
        action: String(e.action),
        actorId: (e.actorId as string) ?? null,
        subjectUserId: (e.subjectUserId as string) ?? null,
        entityType: String(e.entityType),
        entityId: String(e.entityId),
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
        occurredAt: asDate(e.occurredAt as string)!,
        createdAt: asDate(e.createdAt as string) ?? new Date(),
        updatedAt: asDate(e.updatedAt as string) ?? new Date(),
      },
      update: { action: String(e.action) },
    }),
  );

  const promos = readJson<Array<Record<string, unknown>>>("promos.json");
  for (const p of promos) {
    await prisma.promoSlide.upsert({
      where: { id: String(p.id) },
      create: {
        id: String(p.id),
        title: String(p.title),
        body: String(p.body),
        imageUrl: p.imageUrl == null ? null : String(p.imageUrl),
        qrUrl: p.qrUrl == null ? null : String(p.qrUrl),
        startsAt: asDate(p.startsAt as string)!,
        endsAt: asDate(p.endsAt as string)!,
        active: Boolean(p.active ?? true),
        sortOrder: Number(p.sortOrder ?? 0),
        createdAt: asDate(p.createdAt as string) ?? new Date(),
        updatedAt: asDate(p.updatedAt as string) ?? new Date(),
      },
      update: {
        title: String(p.title),
        body: String(p.body),
        imageUrl: p.imageUrl == null ? null : String(p.imageUrl),
        qrUrl: p.qrUrl == null ? null : String(p.qrUrl),
        startsAt: asDate(p.startsAt as string)!,
        endsAt: asDate(p.endsAt as string)!,
        active: Boolean(p.active ?? true),
        sortOrder: Number(p.sortOrder ?? 0),
      },
    });
  }

  const displayConfig = readJson<Record<string, unknown>>("display-config.json");
  await prisma.displayConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      panelOrder: JSON.stringify(displayConfig.panelOrder ?? []),
      cadenceSeconds: Number(displayConfig.cadenceSeconds ?? 12),
      pinnedPanel:
        displayConfig.pinnedPanel == null
          ? null
          : String(displayConfig.pinnedPanel),
      nameDisplayMode: String(displayConfig.nameDisplayMode ?? "first"),
      membershipEveryNRotations: Number(
        displayConfig.membershipEveryNRotations ?? 3,
      ),
    },
    update: {
      panelOrder: JSON.stringify(displayConfig.panelOrder ?? []),
      cadenceSeconds: Number(displayConfig.cadenceSeconds ?? 12),
      pinnedPanel:
        displayConfig.pinnedPanel == null
          ? null
          : String(displayConfig.pinnedPanel),
      nameDisplayMode: String(displayConfig.nameDisplayMode ?? "first"),
      membershipEveryNRotations: Number(
        displayConfig.membershipEveryNRotations ?? 3,
      ),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
