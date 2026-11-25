import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const users = new Map<string, Row>();
const audits: Row[] = [];
let failFind = false;

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: async ({ where }: { where: { status: string; membershipEndsAt: { lt: Date } } }) => {
        if (failFind) throw new Error("D1 is down");
        return [...users.values()].filter(
          (u) =>
            u.status === where.status &&
            u.membershipEndsAt instanceof Date &&
            u.membershipEndsAt < where.membershipEndsAt.lt,
        );
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string; membershipEndsAt: Date }; data: Row }) => {
        const row = users.get(where.id);
        const same =
          row &&
          row.status === where.status &&
          row.membershipEndsAt instanceof Date &&
          +row.membershipEndsAt === +where.membershipEndsAt;
        if (!same) return { count: 0 };
        users.set(where.id, { ...row, ...data });
        return { count: 1 };
      },
    },
    auditEvent: {
      create: async ({ data }: { data: Row }) => {
        audits.push(data);
        return data;
      },
    },
  },
}));

const NOW = new Date("2027-02-21T19:00:00Z").getTime();

function member(id: string, over: Row = {}) {
  users.set(id, {
    id,
    status: "active",
    tier: "community",
    shopAccess: true,
    membershipEndsAt: new Date("2027-02-21T18:00:00Z"),
    ...over,
  });
}

describe("lapseEndedMemberships", () => {
  beforeEach(() => {
    users.clear();
    audits.length = 0;
    failFind = false;
  });

  it("lapses a gifted membership once its end date has passed", async () => {
    member("u-gift");
    const { lapseEndedMemberships } = await import("./lapse");
    expect(await lapseEndedMemberships(NOW)).toBe(1);
    expect(users.get("u-gift")).toMatchObject({ status: "lapsed", shopAccess: false });
    // The tier and the date stay, so staff can see what ended and when.
    expect(users.get("u-gift")?.tier).toBe("community");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "membership_lapsed",
      actorId: null,
      subjectUserId: "u-gift",
    });
  });

  it("leaves alone a membership that has not ended, and a paying member with no end date", async () => {
    member("u-running", { membershipEndsAt: new Date("2027-03-01T00:00:00Z") });
    member("u-paying", { membershipEndsAt: null });
    const { lapseEndedMemberships } = await import("./lapse");
    expect(await lapseEndedMemberships(NOW)).toBe(0);
    expect(users.get("u-running")?.status).toBe("active");
    expect(users.get("u-paying")?.status).toBe("active");
    expect(audits).toEqual([]);
  });

  it("does not lapse someone twice", async () => {
    member("u-gift");
    const { lapseEndedMemberships } = await import("./lapse");
    await lapseEndedMemberships(NOW);
    expect(await lapseEndedMemberships(NOW + 3_600_000)).toBe(0);
    expect(audits).toHaveLength(1);
  });

  it("skips a member whose end date moved after the list was read", async () => {
    member("u-extended");
    const { lapseEndedMemberships } = await import("./lapse");
    const run = lapseEndedMemberships(NOW);
    // They redeemed another code in the meantime.
    users.set("u-extended", {
      ...users.get("u-extended")!,
      membershipEndsAt: new Date("2027-05-21T18:00:00Z"),
    });
    expect(await run).toBe(0);
    expect(users.get("u-extended")?.status).toBe("active");
  });

  it("never throws: the class sync that follows it must still run", async () => {
    failFind = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { lapseEndedMemberships } = await import("./lapse");
    expect(await lapseEndedMemberships(NOW)).toBe(0);
    logged.mockRestore();
  });
});
