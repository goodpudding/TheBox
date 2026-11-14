import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PIN_SET_ACTION,
  pinEmailHash,
  readPinThrottle,
  recordPinFailure,
} from "@/lib/workstation/pin-throttle";

type Row = {
  action: string;
  occurredAt: Date;
  metadata: string;
  actorId?: string | null;
  subjectUserId?: string | null;
};
const rows: Row[] = [];
const isStaffRequest = vi.fn();
const updateUser = vi.fn();
const MAYA = { id: "u-maya", email: "maya@example.com" };

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});
vi.mock("@/lib/workstation/server", () => ({
  isStaffRequest: (...args: unknown[]) => isStaffRequest(...args),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: async (args: { where: { id: string } }) =>
        args.where.id === MAYA.id ? MAYA : null,
      update: (args: unknown) => updateUser(args),
    },
    auditEvent: {
      create: async (args: { data: Row }) => {
        rows.push(args.data);
        return args.data;
      },
      findFirst: async (args: {
        where: {
          action: string;
          subjectUserId: string;
          actorId: string;
          occurredAt: { gte: Date };
        };
      }) =>
        rows.find(
          (row) =>
            row.action === args.where.action &&
            row.subjectUserId === args.where.subjectUserId &&
            row.actorId === args.where.actorId &&
            row.occurredAt >= args.where.occurredAt.gte,
        ) ?? null,
      findMany: async (args: {
        where: { action: { in: string[] }; metadata: { contains: string } };
      }) =>
        rows
          .filter(
            (row) =>
              args.where.action.in.includes(row.action) &&
              row.metadata.includes(args.where.metadata.contains),
          )
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()),
    },
  },
}));

async function reset(memberId: string, temporaryPin = "482917") {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/admin/members/${memberId}/kiosk-pin`, {
      method: "POST",
      body: JSON.stringify({ temporaryPin }),
    }) as never,
    { params: Promise.resolve({ id: memberId }) },
  );
}

describe("POST /api/admin/members/[id]/kiosk-pin", () => {
  beforeEach(() => {
    rows.length = 0;
    isStaffRequest.mockReset();
    updateUser.mockReset();
    updateUser.mockResolvedValue(MAYA);
  });

  it("lets a locked-out member back in once staff reset the PIN", async () => {
    const start = Date.now() - 60 * 60 * 1000;
    for (let i = 0; i < 20; i++) {
      await recordPinFailure({
        email: MAYA.email,
        userId: MAYA.id,
        entityId: "qr-approve",
        now: start + i * 1000,
      });
    }
    expect((await readPinThrottle(MAYA.email)).locked).toBe(true);

    isStaffRequest.mockResolvedValue({ id: "u-staff" });
    const res = await reset(MAYA.id);
    expect(res.status).toBe(200);

    expect((await readPinThrottle(MAYA.email)).locked).toBe(false);
    const marker = rows.find((row) => row.action === PIN_SET_ACTION);
    expect(marker?.metadata).toContain(pinEmailHash(MAYA.email));
    // The audit rows never hold the email or the PIN.
    // Everything the route chose to store. The row id is random hex and can
    // spell out any digits by chance, so it is left out of the search.
    const stored = JSON.stringify(rows.map((row) => ({ ...row, id: undefined })));
    expect(stored).not.toContain(MAYA.email);
    expect(stored).not.toContain("482917");
  });

  it("changes nothing for someone who is not staff", async () => {
    isStaffRequest.mockResolvedValue(null);
    const res = await reset(MAYA.id);
    expect(res.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it("writes the reset into the audit log once", async () => {
    isStaffRequest.mockResolvedValue({ id: "u-staff" });
    expect((await reset(MAYA.id)).status).toBe(200);
    expect(rows.filter((row) => row.action === "member.pin_reset")).toHaveLength(1);
  });

  it("does not log it a second time when the member page has just logged it", async () => {
    // The staff page resets the PIN through the data API, which writes the
    // audit row, and then calls this route with the same PIN.
    rows.push({
      action: "member.pin_reset",
      actorId: "u-staff",
      subjectUserId: MAYA.id,
      occurredAt: new Date(Date.now() - 2000),
      metadata: JSON.stringify({ mustChange: true }),
    });
    isStaffRequest.mockResolvedValue({ id: "u-staff" });
    expect((await reset(MAYA.id)).status).toBe(200);
    expect(rows.filter((row) => row.action === "member.pin_reset")).toHaveLength(1);
    // It still ends the lock and stores the new PIN.
    expect(rows.filter((row) => row.action === PIN_SET_ACTION)).toHaveLength(1);
    expect(updateUser).toHaveBeenCalledTimes(1);
  });
});
