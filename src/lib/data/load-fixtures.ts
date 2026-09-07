import type { MockFixtureBundle } from "./types";

import users from "../../../data/mock/users.json";
import badges from "../../../data/mock/badges.json";
import certifications from "../../../data/mock/certifications.json";
import userCertifications from "../../../data/mock/user-certifications.json";
import machines from "../../../data/mock/machines.json";
import reservations from "../../../data/mock/reservations.json";
import maintenanceBlocks from "../../../data/mock/maintenance-blocks.json";
import toolChampionTerms from "../../../data/mock/tool-champion-terms.json";
import usageSessions from "../../../data/mock/usage-sessions.json";
import accessLogs from "../../../data/mock/access-logs.json";
import classSessions from "../../../data/mock/class-sessions.json";
import bookings from "../../../data/mock/bookings.json";
import learningModules from "../../../data/mock/learning-modules.json";
import lessons from "../../../data/mock/lessons.json";
import questions from "../../../data/mock/questions.json";
import lessonProgress from "../../../data/mock/lesson-progress.json";
import quizAttempts from "../../../data/mock/quiz-attempts.json";
import volunteerRoles from "../../../data/mock/volunteer-roles.json";
import volunteerInterests from "../../../data/mock/volunteer-interests.json";
import contentPages from "../../../data/mock/content-pages.json";
import waiverSignatures from "../../../data/mock/waiver-signatures.json";
import policyAcknowledgements from "../../../data/mock/policy-acknowledgements.json";
import auditEvents from "../../../data/mock/audit-events.json";
import membershipProducts from "../../../data/mock/membership-products.json";
import settings from "../../../data/mock/settings.json";
import promoSlides from "../../../data/mock/promos.json";
import displayConfig from "../../../data/mock/display-config.json";

function isoOffset(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

/** Live sessions/blocks/classes so the lobby display always has demo content. */
function withDisplayLiveOverlays(
  bundle: MockFixtureBundle,
): MockFixtureBundle {
  const hour = 3600_000;
  const liveUsage = [
    {
      id: "us-live-prusa",
      userId: "u-maya",
      machineId: "m-prusa-mk4",
      badgeId: "badge-maya",
      startedAt: isoOffset(-45 * 60_000),
      endedAt: null,
      reservationId: null,
      endedBy: "reader" as const,
      createdAt: isoOffset(-45 * 60_000),
      updatedAt: isoOffset(-45 * 60_000),
    },
    {
      id: "us-live-sewing",
      userId: "u-sam",
      machineId: "m-sewing-1",
      badgeId: "badge-sam",
      startedAt: isoOffset(-20 * 60_000),
      endedAt: null,
      reservationId: null,
      endedBy: "reader" as const,
      createdAt: isoOffset(-20 * 60_000),
      updatedAt: isoOffset(-20 * 60_000),
    },
    {
      id: "us-live-heatpress",
      userId: "u-jordan",
      machineId: "m-heat-press",
      badgeId: "badge-jordan",
      startedAt: isoOffset(-10 * 60_000),
      endedAt: null,
      reservationId: null,
      endedBy: "reader" as const,
      createdAt: isoOffset(-10 * 60_000),
      updatedAt: isoOffset(-10 * 60_000),
    },
  ];

  const liveMaint = {
    id: "maint-live-bandsaw",
    machineId: "m-band-saw",
    startsAt: isoOffset(-2 * hour),
    endsAt: isoOffset(6 * hour),
    reason: "Blade tracking adjustment",
    createdById: "u-staff",
    createdAt: isoOffset(-2 * hour),
    updatedAt: isoOffset(-2 * hour),
  };

  const liveRes = {
    id: "res-live-laser",
    userId: "u-quinn",
    machineId: "m-laser-co2",
    startsAt: isoOffset(90 * 60_000),
    endsAt: isoOffset(150 * 60_000),
    status: "booked" as const,
    createdById: "u-quinn",
    cancelledAt: null,
    cancelReason: null,
    createdAt: isoOffset(-hour),
    updatedAt: isoOffset(-hour),
  };

  const liveClassToday = {
    id: "class-live-today-orient",
    title: "Shop Orientation",
    slug: "shop-orientation-live-today",
    descriptionSlug: "class-shop-orientation",
    category: "orientation" as const,
    instructorId: "u-staff",
    startsAt: isoOffset(2 * hour),
    endsAt: isoOffset(3.5 * hour),
    capacity: 12,
    priceCents: 0,
    zeffyUrl: null,
    prerequisiteCertificationIds: [] as string[],
    location: "The Box — Main Floor",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: isoOffset(-24 * hour),
    updatedAt: isoOffset(-hour),
  };

  const liveCheckoff = {
    id: "class-live-checkoff-laser",
    title: "Laser Cutter Checkoff",
    slug: "laser-checkoff-live",
    descriptionSlug: "class-laser-basics",
    category: "certification_checkoff" as const,
    instructorId: "u-admin",
    startsAt: isoOffset(26 * hour),
    endsAt: isoOffset(28 * hour),
    capacity: 4,
    priceCents: 0,
    zeffyUrl: null,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "Laser room",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: isoOffset(-24 * hour),
    updatedAt: isoOffset(-hour),
  };

  const liveWorkshop = {
    id: "class-live-workshop-3d",
    title: "Intro to 3D Printing",
    slug: "3d-printing-live-weekend",
    descriptionSlug: "class-3d-printing-intro",
    category: "workshop" as const,
    instructorId: "u-staff",
    startsAt: isoOffset(50 * hour),
    endsAt: isoOffset(52 * hour),
    capacity: 8,
    priceCents: 3500,
    zeffyUrl: "https://www.zeffy.com/en-US/donation-form/example-the-box",
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — 3D Corner",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: isoOffset(-24 * hour),
    updatedAt: isoOffset(-hour),
  };

  return {
    ...bundle,
    usageSessions: [...bundle.usageSessions, ...liveUsage],
    maintenanceBlocks: [...bundle.maintenanceBlocks, liveMaint],
    reservations: [...bundle.reservations, liveRes],
    classSessions: [
      ...bundle.classSessions,
      liveClassToday,
      liveCheckoff,
      liveWorkshop,
    ],
  };
}

/** Load the static mock fixture bundle (module-level imports; do not mutate). */
export function loadFixtures(): MockFixtureBundle {
  const base: MockFixtureBundle = {
    users: (users as Array<Record<string, unknown>>).map((u) => ({
      ...u,
      newsletterOptIn: Boolean(u.newsletterOptIn),
    })) as MockFixtureBundle["users"],
    badges: badges as MockFixtureBundle["badges"],
    certifications: certifications as MockFixtureBundle["certifications"],
    userCertifications:
      userCertifications as MockFixtureBundle["userCertifications"],
    machines: (machines as Array<Record<string, unknown>>).map((m) => ({
      ...m,
      reservationRequired: m.reservationRequired ?? false,
      locationLabel: m.locationLabel ?? "",
      gettingStartedVideoUrl: m.gettingStartedVideoUrl ?? null,
    })) as MockFixtureBundle["machines"],
    reservations: reservations as MockFixtureBundle["reservations"],
    maintenanceBlocks:
      maintenanceBlocks as MockFixtureBundle["maintenanceBlocks"],
    toolChampionTerms:
      toolChampionTerms as MockFixtureBundle["toolChampionTerms"],
    usageSessions: usageSessions as MockFixtureBundle["usageSessions"],
    accessLogs: accessLogs as MockFixtureBundle["accessLogs"],
    classSessions: classSessions as MockFixtureBundle["classSessions"],
    bookings: bookings as MockFixtureBundle["bookings"],
    learningModules: learningModules as MockFixtureBundle["learningModules"],
    lessons: lessons as MockFixtureBundle["lessons"],
    questions: questions as MockFixtureBundle["questions"],
    lessonProgress: lessonProgress as MockFixtureBundle["lessonProgress"],
    quizAttempts: quizAttempts as MockFixtureBundle["quizAttempts"],
    volunteerRoles: volunteerRoles as MockFixtureBundle["volunteerRoles"],
    volunteerInterests:
      volunteerInterests as MockFixtureBundle["volunteerInterests"],
    contentPages: contentPages as MockFixtureBundle["contentPages"],
    waiverSignatures:
      waiverSignatures as MockFixtureBundle["waiverSignatures"],
    policyAcknowledgements:
      policyAcknowledgements as MockFixtureBundle["policyAcknowledgements"],
    auditEvents: auditEvents as MockFixtureBundle["auditEvents"],
    membershipProducts:
      membershipProducts as MockFixtureBundle["membershipProducts"],
    settings: settings as MockFixtureBundle["settings"],
    promoSlides: promoSlides as MockFixtureBundle["promoSlides"],
    displayConfig: displayConfig as MockFixtureBundle["displayConfig"],
  };
  return withDisplayLiveOverlays(base);
}

/** Deep-clone fixtures for mutable provider state. */
export function cloneFixtures(bundle: MockFixtureBundle): MockFixtureBundle {
  return structuredClone(bundle);
}
