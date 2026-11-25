import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDataProvider } from "@/lib/data/mock-provider";

/**
 * A class staff cancel from the admin has to leave the Google calendar, stay
 * off it, and come back when staff restore it. This runs the real calendar
 * push (the one the hourly sync calls) against a stand-in for Google and a
 * stand-in for the ClassSession table, and cancels and restores through the
 * same provider methods the admin page uses.
 */

type Row = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  capacity: number;
  zeffyUrl: string | null;
  location: string;
  source: string;
  googleEventId: string | null;
  googleCalendarId: string | null;
  cancelledAt: Date | null;
};

const rows = new Map<string, Row>();

vi.mock("@/lib/db", () => ({
  prisma: {
    classSession: {
      findMany: async () => [...rows.values()].map((row) => ({ ...row })),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.get(where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
  },
}));

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

/** Every request the push made to Google's calendar API, as "METHOD path". */
let requests: string[] = [];
let nextEvent = 1;

beforeEach(() => {
  rows.clear();
  requests = [];
  nextEvent = 1;
  vi.stubEnv(
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    JSON.stringify({ client_email: "sync@example.iam.gserviceaccount.com", private_key: privateKey }),
  );
  vi.stubEnv("GOOGLE_CALENDAR_CLASSES_ID", "classes-cal");
  vi.stubEnv("GOOGLE_CALENDAR_COMMUNITY_ID", "community-cal");
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "token" });
    }
    const method = init?.method ?? "GET";
    requests.push(`${method} ${new URL(url).pathname.replace("/calendar/v3/calendars/", "")}`);
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method === "POST") return Response.json({ id: `evt_${nextEvent++}` });
    return Response.json({ id: url.split("/").at(-1) });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a class staff cancel from the admin", () => {
  it("leaves the Google calendar, stays off it, and returns when restored", async () => {
    const { pushGoogle } = await import("./run");
    const admin = (await createMockDataProvider().adminListMembers()).find(
      (u) => u.role === "admin",
    )!;
    const provider = createMockDataProvider(admin.id);
    const session = await provider.adminUpsertClass({
      title: "Kiln firing night",
      category: "workshop",
      instructorId: admin.id,
      startsAt: "2026-12-10T02:00:00.000Z",
      endsAt: "2026-12-10T04:00:00.000Z",
      capacity: 8,
      priceCents: 4000,
      location: "Discover Burien Makerspace",
      published: true,
    } as never);
    rows.set(session.id, {
      id: session.id,
      title: session.title,
      startsAt: new Date(session.startsAt),
      endsAt: new Date(session.endsAt),
      priceCents: session.priceCents,
      capacity: session.capacity,
      zeffyUrl: null,
      location: session.location,
      source: "admin",
      googleEventId: null,
      googleCalendarId: null,
      cancelledAt: null,
    });
    const row = rows.get(session.id)!;
    const now = new Date("2026-11-24T20:00:00.000Z");

    // First run: the class goes on the paid-classes calendar.
    expect(await pushGoogle(now)).toMatchObject({ created: 1, deleted: 0, errors: [] });
    expect(requests).toEqual(["POST classes-cal/events"]);
    expect(row.googleEventId).toBe("evt_1");
    expect(row.googleCalendarId).toBe("classes-cal");

    // Staff cancel it. The save writes cancelledAt and leaves the event id alone.
    const cancelled = await provider.adminCancelClass(session.id);
    row.cancelledAt = new Date(cancelled.cancelledAt!);
    requests = [];
    expect(await pushGoogle(now)).toMatchObject({ created: 0, deleted: 1, errors: [] });
    expect(requests).toEqual(["DELETE classes-cal/events/evt_1"]);
    expect(row.googleEventId).toBeNull();
    expect(row.googleCalendarId).toBeNull();

    // Later runs do not put it back.
    requests = [];
    expect(await pushGoogle(now)).toMatchObject({ created: 0, updated: 0, deleted: 0 });
    expect(await pushGoogle(now)).toMatchObject({ created: 0, updated: 0, deleted: 0 });
    expect(requests).toEqual([]);

    // Staff restore it: it gets a new event.
    const restored = await provider.adminRestoreClass(session.id);
    expect(restored.cancelledAt).toBeNull();
    row.cancelledAt = null;
    expect(await pushGoogle(now)).toMatchObject({ created: 1, deleted: 0, errors: [] });
    expect(requests).toEqual(["POST classes-cal/events"]);
    expect(row.googleEventId).toBe("evt_2");

    // And from then on it is only kept up to date.
    requests = [];
    expect(await pushGoogle(now)).toMatchObject({ created: 0, updated: 1, deleted: 0 });
    expect(requests).toEqual(["PATCH classes-cal/events/evt_2"]);
  });

  it("is still tried again next time when Google refuses the delete", async () => {
    const { pushGoogle } = await import("./run");
    rows.set("class_1", {
      id: "class_1",
      title: "Lathe",
      startsAt: new Date("2026-12-10T02:00:00.000Z"),
      endsAt: new Date("2026-12-10T04:00:00.000Z"),
      priceCents: 0,
      capacity: 6,
      zeffyUrl: null,
      location: "Discover Burien Makerspace",
      source: "admin",
      googleEventId: "evt_9",
      googleCalendarId: "community-cal",
      cancelledAt: new Date("2026-11-24T00:00:00.000Z"),
    });
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response("backend error", { status: 500 });
      return realFetch(input, init);
    });
    const result = await pushGoogle(new Date("2026-11-24T20:00:00.000Z"));
    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(1);
    // The event id is kept, so the next run tries the delete again.
    expect(rows.get("class_1")!.googleEventId).toBe("evt_9");
  });
});
