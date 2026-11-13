import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashKioskPin } from "@/lib/workstation/pin";
import { resetPinAttemptStore } from "@/lib/workstation/pin-attempts";

type Challenge = {
  id: string;
  expiresAt: Date;
  consumedAt: Date | null;
  approvedUserId?: string;
};
const challenges = new Map<string, Challenge>();
const auditRows: { action: string }[] = [];
const findFirstUser = vi.fn();
const RIGHT_PIN = "4821";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: (args: unknown) => findFirstUser(args) },
    workstationLoginChallenge: {
      findUnique: async (args: { where: { id: string } }) =>
        challenges.get(args.where.id) ?? null,
      update: async (args: { where: { id: string }; data: { approvedUserId: string } }) => {
        const row = challenges.get(args.where.id)!;
        row.approvedUserId = args.data.approvedUserId;
        return row;
      },
    },
    auditEvent: {
      create: async (args: { data: { action: string } }) => {
        auditRows.push(args.data);
        return args.data;
      },
      findMany: async () => [],
    },
  },
}));

async function approve(challengeId: string, pin: string) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/workstation/qr/approve", {
      method: "POST",
      body: JSON.stringify({ challengeId, email: "maya@example.com", pin }),
    }) as never,
  );
}

describe("POST /api/workstation/qr/approve", () => {
  beforeEach(async () => {
    challenges.clear();
    auditRows.length = 0;
    resetPinAttemptStore();
    findFirstUser.mockReset();
    findFirstUser.mockResolvedValue({
      id: "u-maya",
      email: "maya@example.com",
      kioskPinHash: await hashKioskPin(RIGHT_PIN),
    });
    challenges.set("wqc_live", {
      id: "wqc_live",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    challenges.set("wqc_old", {
      id: "wqc_old",
      expiresAt: new Date(Date.now() - 60_000),
      consumedAt: null,
    });
  });

  it("does not take a PIN guess without a live QR code from a desk", async () => {
    for (const challengeId of ["made-up", "wqc_old"]) {
      const res = await approve(challengeId, "0001");
      expect(res.status).toBe(410);
    }
    // Nothing was checked or counted against the member.
    expect(findFirstUser).not.toHaveBeenCalled();
    expect(auditRows).toHaveLength(0);
  });

  it("counts a wrong PIN against a live QR code", async () => {
    const res = await approve("wqc_live", "0001");
    expect(res.status).toBe(401);
    expect(auditRows.map((row) => row.action)).toEqual(["workstation.pin_failed"]);
    expect(challenges.get("wqc_live")?.approvedUserId).toBeUndefined();
  });

  it("approves a live QR code with the right PIN", async () => {
    const res = await approve("wqc_live", RIGHT_PIN);
    expect(res.status).toBe(200);
    expect(challenges.get("wqc_live")?.approvedUserId).toBe("u-maya");
  });
});
