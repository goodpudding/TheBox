import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PIN_SET_ACTION,
  pinEmailHash,
  readPinThrottle,
  recordPinFailure,
} from "@/lib/workstation/pin-throttle";

type Row = { action: string; occurredAt: Date; metadata: string };
const rows: Row[] = [];
const memberActorId = vi.fn();
const updateUser = vi.fn();
const MAYA = { id: "u-maya", email: "maya@example.com" };

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});
vi.mock("@/lib/workstation/server", () => ({
  memberActorId: (...args: unknown[]) => memberActorId(...args),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { update: (args: unknown) => updateUser(args) },
    auditEvent: {
      create: async (args: { data: Row }) => {
        rows.push(args.data);
        return args.data;
      },
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

async function setPin(pin: string) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/account/kiosk-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }) as never,
  );
}

describe("POST /api/account/kiosk-pin", () => {
  beforeEach(() => {
    rows.length = 0;
    memberActorId.mockReset();
    updateUser.mockReset();
    updateUser.mockResolvedValue(MAYA);
  });

  it("lets a locked-out member back in once they set a new PIN from their account", async () => {
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

    memberActorId.mockResolvedValue(MAYA.id);
    const res = await setPin("4821");
    expect(res.status).toBe(200);

    expect((await readPinThrottle(MAYA.email)).locked).toBe(false);
    const marker = rows.find((row) => row.action === PIN_SET_ACTION);
    expect(marker?.metadata).toContain(pinEmailHash(MAYA.email));
    // Everything the route chose to store. The row id is random hex and can
    // spell out any digits by chance, so it is left out of the search.
    const stored = JSON.stringify(rows.map((row) => ({ ...row, id: undefined })));
    expect(stored).not.toContain(MAYA.email);
    expect(stored).not.toContain("4821");
  });

  it("changes nothing without a signed-in member", async () => {
    memberActorId.mockResolvedValue(null);
    const res = await setPin("4821");
    expect(res.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });
});
