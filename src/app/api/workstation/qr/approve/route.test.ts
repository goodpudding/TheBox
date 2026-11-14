import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashKioskPin } from "@/lib/workstation/pin";
import { resetPinAttemptStore } from "@/lib/workstation/pin-attempts";
import { RATE_LIMITS, resetRateLimitStore } from "@/lib/rate-limit";

type Challenge = {
  id: string;
  expiresAt: Date;
  consumedAt: Date | null;
  approvedUserId?: string;
};
const challenges = new Map<string, Challenge>();
type AuditRow = { id?: string; action: string; occurredAt: Date; metadata: string };
const auditRows: AuditRow[] = [];
const session = vi.fn<() => Promise<{ user: { id: string } } | null>>();
const findFirstUser = vi.fn();
const RIGHT_PIN = "4821";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});
vi.mock("@/auth", () => ({ auth: () => session() }));
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
      create: async (args: { data: AuditRow }) => {
        auditRows.push(args.data);
        return args.data;
      },
      update: async (args: { where: { id: string }; data: { action: string } }) => {
        const row = auditRows.find((r) => r.id === args.where.id);
        if (row) row.action = args.data.action;
        return row;
      },
      delete: async (args: { where: { id: string } }) => {
        const index = auditRows.findIndex(
          (row) => row.id === args.where.id,
        );
        if (index >= 0) auditRows.splice(index, 1);
      },
      findMany: async (args: { where: { id?: { not: string }; action: { in: string[] } } }) =>
        auditRows.filter(
          (row) => row.id !== args.where.id?.not && args.where.action.in.includes(row.action),
        ),
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
    session.mockReset();
    session.mockResolvedValue(null);
    resetPinAttemptStore();
    resetRateLimitStore();
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

  it("stops taking PINs from one address after a minute's allowance", async () => {
    const allowance = RATE_LIMITS.pinAttempt.limit;
    for (let i = 0; i < allowance; i += 1) {
      // A made-up code: refused, but it still uses up the address's allowance.
      expect((await approve("made-up", "0001")).status, `call ${i + 1}`).toBe(410);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await approve("wqc_live", RIGHT_PIN);
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(findFirstUser).not.toHaveBeenCalled();
    expect(auditRows).toHaveLength(0);
    expect(challenges.get("wqc_live")?.approvedUserId).toBeUndefined();
  });

  it("a locked-out member can still approve from a phone that is signed in to the website", async () => {
    // What the lock message tells them to do, so it has to work.
    for (let i = 0; i < 5; i += 1) {
      expect((await approve("wqc_live", "0001")).status).toBe(401);
    }
    const locked = await approve("wqc_live", RIGHT_PIN);
    expect(locked.status).toBe(429);
    const { error } = (await locked.json()) as { error: string };
    expect(error).toMatch(/^Too many attempts/);
    expect(error).toMatch(/sign in to the website on your phone/i);
    expect(error).toMatch(/staff/i);
    expect(challenges.get("wqc_live")?.approvedUserId).toBeUndefined();

    session.mockResolvedValue({ user: { id: "u-maya" } });
    const res = await approve("wqc_live", "anything");
    expect(res.status).toBe(200);
    expect(challenges.get("wqc_live")?.approvedUserId).toBe("u-maya");
  });
});
