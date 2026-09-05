import { describe, expect, it } from "vitest";
import { evaluateMachineAccess } from "./access";
import type {
  Badge,
  Machine,
  User,
  UserCertification,
  WaiverSignature,
} from "./types";

const baseUser: User = {
  id: "u1",
  email: "a@example.com",
  firstName: "A",
  lastName: "B",
  displayName: "A B",
  role: "member",
  status: "active",
  tier: "maker",
  shopAccess: true,
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00-07:00",
  updatedAt: "2026-01-01T00:00:00-07:00",
};

const badge: Badge = {
  id: "b1",
  uid: "badge-1",
  userId: "u1",
  active: true,
  createdAt: "2026-01-01T00:00:00-07:00",
  updatedAt: "2026-01-01T00:00:00-07:00",
};

const machine: Machine = {
  id: "m1",
  name: "Laser",
  area: "laser",
  requiredCertificationIds: ["cert-orient", "cert-laser"],
  readerKey: "reader-1",
  active: true,
  reservationRecommended: true,
  reservationRequired: false,
  locationLabel: "Laser room · Station 1",
  gettingStartedVideoUrl: null,
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00-07:00",
  updatedAt: "2026-01-01T00:00:00-07:00",
};

const waiver: WaiverSignature = {
  id: "w1",
  userId: "u1",
  version: "2026.1",
  signedAt: "2026-01-01T00:00:00-07:00",
  fullNameTyped: "A B",
  ip: "127.0.0.1",
  createdAt: "2026-01-01T00:00:00-07:00",
  updatedAt: "2026-01-01T00:00:00-07:00",
};

function cert(
  certificationId: string,
  status: UserCertification["status"],
): UserCertification {
  return {
    id: `uc-${certificationId}`,
    userId: "u1",
    certificationId,
    status,
    createdAt: "2026-01-01T00:00:00-07:00",
    updatedAt: "2026-01-01T00:00:00-07:00",
  };
}

const certified = [
  cert("cert-orient", "certified"),
  cert("cert-laser", "certified"),
] as const;

describe("evaluateMachineAccess", () => {
  it("allows when active, waiver current, badge linked, certs certified", () => {
    const result = evaluateMachineAccess({
      user: baseUser,
      badge,
      machine,
      userCertifications: [...certified],
      waiverSignatures: [waiver],
      currentWaiverVersion: "2026.1",
    });
    expect(result).toEqual({ allow: true, reason: "ok" });
  });

  it("denies friend tier with no shop access", () => {
    const result = evaluateMachineAccess({
      user: { ...baseUser, shopAccess: false, tier: "friend" },
      badge,
      machine,
      userCertifications: [...certified],
      waiverSignatures: [waiver],
      currentWaiverVersion: "2026.1",
    });
    expect(result.allow).toBe(false);
    expect(result.reason).toBe("no_shop_access");
  });

  it("denies outdated waiver", () => {
    const result = evaluateMachineAccess({
      user: baseUser,
      badge,
      machine,
      userCertifications: [...certified],
      waiverSignatures: [{ ...waiver, version: "2025.2" }],
      currentWaiverVersion: "2026.1",
    });
    expect(result.reason).toBe("waiver_outdated");
  });

  it("denies knowledge_passed without checkoff", () => {
    const result = evaluateMachineAccess({
      user: baseUser,
      badge,
      machine,
      userCertifications: [
        cert("cert-orient", "certified"),
        cert("cert-laser", "knowledge_passed"),
      ],
      waiverSignatures: [waiver],
      currentWaiverVersion: "2026.1",
    });
    expect(result.reason).toBe("cert_missing");
  });

  it("denies when reservationRequired and no overlapping reservation", () => {
    const result = evaluateMachineAccess({
      user: baseUser,
      badge,
      machine: { ...machine, reservationRequired: true },
      userCertifications: [...certified],
      waiverSignatures: [waiver],
      currentWaiverVersion: "2026.1",
      hasOverlappingReservation: false,
    });
    expect(result).toEqual({
      allow: false,
      reason: "reservation_required",
    });
  });

  it("allows when reservationRequired and overlapping reservation present", () => {
    const result = evaluateMachineAccess({
      user: baseUser,
      badge,
      machine: { ...machine, reservationRequired: true },
      userCertifications: [...certified],
      waiverSignatures: [waiver],
      currentWaiverVersion: "2026.1",
      hasOverlappingReservation: true,
    });
    expect(result).toEqual({ allow: true, reason: "ok" });
  });
});
