import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RATE_CARD, RATE_CARD_RECORD_ID } from "@/lib/rate-card";
import { siteRecordId } from "@/lib/data/persist-delta";

type Row = Record<string, unknown>;

const machines = new Map<string, Row>();
const users = new Map<string, Row>();
/** The stored rate card row, or null when staff have never saved one. */
let storedCard: string | null = null;
const jobs: Row[] = [];
const ledger: Row[] = [];
const cardReads = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    machine: { findUnique: async ({ where }: { where: { id: string } }) => machines.get(where.id) ?? null },
    user: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = users.get(where.id);
        if (!row) throw new Error("No user");
        return row;
      },
    },
    siteRecord: {
      findUnique: async (args: { where: { id: string } }) => {
        cardReads(args.where.id);
        return storedCard === null ? null : { id: args.where.id, data: storedCard };
      },
    },
    equipmentJob: {
      create: async ({ data }: { data: Row }) => {
        jobs.push(data);
        return data;
      },
    },
    creditLedgerEntry: {
      create: async ({ data }: { data: Row }) => {
        ledger.push(data);
        return data;
      },
    },
  },
}));

const NOW = new Date("2026-10-15T18:00:00Z");

function machine(id: string, name: string, area: string): Row {
  return {
    id,
    name,
    area,
    requiredCertificationIds: "[]",
    readerKey: `reader-${id}`,
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    attendedOperationRequired: false,
    locationLabel: "",
    gettingStartedVideoUrl: null,
    maxReservationHours: null,
    sortOrder: 1,
    // A stale copy of an old rate. Billing must not read it.
    hourlyRateCents: 9999,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function user(id: string, tier: string | null, status = "active"): Row {
  return {
    id,
    email: `${id}@example.com`,
    firstName: "Test",
    lastName: "Member",
    displayName: "Test Member",
    role: "member",
    status,
    tier,
    shopAccess: true,
    isTeacher: false,
    profileComplete: true,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

async function send(input: {
  userId: string;
  machineId: string;
  runtimeSeconds?: number;
  filamentGrams?: number;
  prints?: number;
}) {
  const { recordEquipmentJob } = await import("./jobs");
  return recordEquipmentJob(input);
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  machines.clear();
  users.clear();
  jobs.length = 0;
  ledger.length = 0;
  cardReads.mockReset();
  storedCard = null;
  machines.set("m-laser", machine("m-laser", "Glowforge Laser", "laser"));
  machines.set("m-printer", machine("m-printer", "Bambu A1", "3d_printing"));
  users.set("u-member", user("u-member", "maker"));
  users.set("u-day", user("u-day", "day"));
});

describe("recordEquipmentJob", () => {
  it("keeps the card under the id the site records use", () => {
    expect(RATE_CARD_RECORD_ID).toBe(siteRecordId("rateCard", "default"));
  });

  it("charges today's prices when no card has been saved", async () => {
    const job = await send({ userId: "u-member", machineId: "m-laser", runtimeSeconds: 3600 });
    expect(job.billedCents).toBe(1500);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ userId: "u-member", kind: "machine", amountCents: -1500 });
  });

  it("charges from the saved card, for members and non-members", async () => {
    storedCard = JSON.stringify({
      ...DEFAULT_RATE_CARD,
      laserMemberHourlyCents: 1800,
      laserNonmemberHourlyCents: 3000,
    });
    const memberJob = await send({ userId: "u-member", machineId: "m-laser", runtimeSeconds: 3600 });
    const guestJob = await send({ userId: "u-day", machineId: "m-laser", runtimeSeconds: 1800 });
    expect(memberJob.billedCents).toBe(1800);
    expect(guestJob.billedCents).toBe(1500);
    expect(ledger.map((l) => l.amountCents)).toEqual([-1800, -1500]);
    expect(jobs.map((j) => j.billedCents)).toEqual([1800, 1500]);
  });

  it("reads the card once for a job", async () => {
    await send({ userId: "u-member", machineId: "m-laser", runtimeSeconds: 3600 });
    expect(cardReads.mock.calls).toEqual([[RATE_CARD_RECORD_ID]]);
  });

  it("prices filament from the saved cost and markup", async () => {
    storedCard = JSON.stringify({ filamentCentsPerKg: 2000, filamentMarkup: 1.5 });
    const job = await send({ userId: "u-member", machineId: "m-printer", filamentGrams: 100 });
    expect(job.billedCents).toBe(300);
  });

  it("falls back field by field when the saved card is damaged", async () => {
    storedCard = JSON.stringify({ laserMemberHourlyCents: -50, laserMinimumCents: 700 });
    const long = await send({ userId: "u-member", machineId: "m-laser", runtimeSeconds: 3600 });
    const short = await send({ userId: "u-member", machineId: "m-laser", runtimeSeconds: 60 });
    // The bad hourly rate is ignored; the good minimum is kept.
    expect(long.billedCents).toBe(1500);
    expect(short.billedCents).toBe(700);
  });

  it("uses today's prices, and says so in the log, when the saved card cannot be read at all", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    storedCard = "{not json";
    const job = await send({ userId: "u-member", machineId: "m-laser", runtimeSeconds: 3600 });
    expect(job.billedCents).toBe(1500);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("takes no price from the caller", async () => {
    const { recordEquipmentJob } = await import("./jobs");
    const job = await recordEquipmentJob({
      userId: "u-member",
      machineId: "m-printer",
      filamentGrams: 100,
      // Not part of the input any more. A stray field must change nothing.
      ...({ filamentCentsPerKg: 1, billedCents: 0, rates: { filamentCentsPerKg: 1 } } as object),
    });
    expect(job.billedCents).toBe(156);
  });
});
