import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneFixtures, loadFixtures } from "./load-fixtures";
import { MockDataProvider } from "./mock-provider";

type Row = Record<string, unknown>;

/** Every Prisma call the code under test makes, in order. */
const calls: Array<{ model: string; method: string; args: unknown }> = [];
/** In-memory tables behind the mocked client, keyed by delegate name. */
const tables = new Map<string, Map<string, Row>>();
/** While set, a `findMany` reads its rows and then waits here before returning. */
let hold: Promise<void> | null = null;
/** Delegates whose reads fail, as when a table or column is not there yet. */
const broken = new Set<string>();

function table(model: string): Map<string, Row> {
  let rows = tables.get(model);
  if (!rows) {
    rows = new Map();
    tables.set(model, rows);
  }
  return rows;
}

vi.mock("@/lib/db", () => {
  type Args = {
    where?: { id?: string | { in: string[] } };
    create?: Row;
    update?: Row;
    data?: Row;
  };
  const delegate = (model: string) => {
    const methods: Record<string, (args?: Args) => Promise<unknown>> = {
      async findMany() {
        if (broken.has(model)) throw new Error(`no such table: ${model}`);
        const rows = [...table(model).values()].map((row) => ({ ...row }));
        if (hold) await hold;
        return rows;
      },
      async findUnique(args) {
        if (broken.has(model)) throw new Error(`no such table: ${model}`);
        const row = table(model).get(String(args?.where?.id));
        return row ? { ...row } : null;
      },
      async upsert(args) {
        const id = String(args?.where?.id);
        const existing = table(model).get(id);
        table(model).set(
          id,
          existing ? { ...existing, ...args?.update } : { ...args?.create },
        );
        return table(model).get(id);
      },
      async update(args) {
        const id = String(args?.where?.id);
        table(model).set(id, { ...table(model).get(id), ...args?.data });
        return table(model).get(id);
      },
      async create(args) {
        table(model).set(String(args?.data?.id), { ...args?.data });
        return args?.data;
      },
      async deleteMany(args) {
        const where = args?.where?.id;
        const ids = typeof where === "object" ? where.in : [];
        for (const id of ids) table(model).delete(id);
        return { count: ids.length };
      },
    };
    return new Proxy(methods, {
      get: (target, method: string) => async (args?: Args) => {
        calls.push({ model, method, args });
        return target[method] ? target[method](args) : { count: 0 };
      },
    });
  };
  return {
    prisma: new Proxy({}, { get: (_t, model: string) => delegate(model) }),
  };
});

const MEMBER = "u-maya";

const PROFILE = {
  firstName: "Maya",
  lastName: "Chen-Okafor",
  phone: "555-0100",
  emergencyContactName: "Sam Chen",
  emergencyContactPhone: "555-0101",
  emergencyContactRelation: "Sibling",
};

/** Columns a member's own profile save must never write. */
const STAFF_COLUMNS = ["role", "status", "tier", "shopAccess"] as const;

function upserts(model: string) {
  return calls
    .filter((c) => c.model === model && c.method === "upsert")
    .map((c) => c.args as { where: { id: string }; create: Row; update: Row });
}

function loads(): number {
  return calls.filter((c) => c.model === "user" && c.method === "findMany")
    .length;
}

/** Fill the mocked database from the fixtures, through the real row mapping. */
async function seedDatabase() {
  const { persistBundleToPrisma } = await import("./prisma-provider");
  await persistBundleToPrisma(cloneFixtures(loadFixtures()));
  calls.length = 0;
}

/** A write that lands from somewhere else: another isolate, or the Zeffy webhook. */
function writeElsewhere(model: string, id: string, data: Row) {
  const row = table(model).get(id);
  if (!row) throw new Error(`No ${model} row ${id}`);
  table(model).set(id, { ...row, ...data });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  calls.length = 0;
  tables.clear();
  hold = null;
  broken.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("persistBundleToPrisma", () => {
  it("keeps defaultInstructorId on a settings-only save", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const instructor = previous.users[0]!;
    previous.settings.defaultInstructorId = instructor.id;
    const next = structuredClone(previous);
    next.settings.orgName = "Burien Makers (renamed)";

    await persistBundleToPrisma(next, previous);

    const [upsert] = upserts("orgSettings");
    expect(upsert).toBeTruthy();
    expect(upsert!.create.defaultInstructorId).toBe(instructor.id);
    expect(upsert!.update).toEqual({ orgName: "Burien Makers (renamed)" });
    expect(calls.some((c) => c.model === "user")).toBe(false);
  });

  it("hard-deletes a removed question", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const next = structuredClone(previous);
    const [question] = next.questions.splice(0, 1);

    await persistBundleToPrisma(next, previous);

    const deletes = calls.filter((c) => c.method === "deleteMany");
    expect(deletes).toEqual([
      {
        model: "question",
        method: "deleteMany",
        args: { where: { id: { in: [question!.id] } } },
      },
    ]);
  });

  it("removes a lesson from the database after everything that points at it", async () => {
    // D1 refuses to delete a lesson while a video or a progress row still
    // names it, and a video while a watch record does.
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const detail = await admin.getModule("shop-orientation");
    const lesson = detail!.lessons.find((l) => l.videos.length > 0)!;
    const videoIds = lesson.videos.map((v) => v.id);
    await admin.markVideoWatched(videoIds[0]!, "u-maya");
    await admin.markLessonComplete(lesson.id, "u-maya");
    calls.length = 0;

    await admin.adminDeleteLesson(lesson.id);

    const deletes = calls
      .filter((c) => c.method === "deleteMany")
      .map((c) => c.model);
    expect(deletes).toEqual(["videoWatch", "lessonVideo", "lessonProgress", "lesson"]);
    expect(table("lesson").has(lesson.id)).toBe(false);
    for (const id of videoIds) expect(table("lessonVideo").has(id)).toBe(false);
    expect(
      [...table("lessonProgress").values()].some((row) => row.lessonId === lesson.id),
    ).toBe(false);
    expect(
      [...table("videoWatch").values()].some((row) => videoIds.includes(String(row.videoId))),
    ).toBe(false);
    // Nobody's certification is part of the removal.
    expect(calls.some((c) => c.model === "userCertification")).toBe(false);

    const later = await createPrismaDataProvider("u-admin", { fresh: true });
    expect((await later.getModule("shop-orientation"))!.lessons.map((l) => l.id)).not.toContain(
      lesson.id,
    );
  });

  it("a profile edit writes only the columns it changed", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const mock = new MockDataProvider(previous, MEMBER);
    await mock.updateMemberProfile(MEMBER, PROFILE);

    await persistBundleToPrisma(mock.getState(), previous);

    const [upsert, ...rest] = upserts("user");
    expect(rest).toEqual([]);
    expect(upsert!.where).toEqual({ id: MEMBER });
    for (const column of STAFF_COLUMNS) {
      expect(upsert!.update).not.toHaveProperty(column);
    }
    expect(Object.keys(upsert!.update).sort()).toEqual([
      "displayName",
      "emergencyContactName",
      "emergencyContactPhone",
      "emergencyContactRelation",
      "lastName",
      "phone",
      "updatedAt",
    ]);
    expect(upsert!.update.lastName).toBe("Chen-Okafor");
  });

  it("a staff status change writes status and not the profile", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const mock = new MockDataProvider(previous, "u-admin");
    await mock.adminUpdateMemberStatus(MEMBER, "suspended", "u-admin");

    await persistBundleToPrisma(mock.getState(), previous);

    const [upsert] = upserts("user");
    expect(upsert!.update.status).toBe("suspended");
    expect(upsert!.update).not.toHaveProperty("firstName");
    expect(upsert!.update).not.toHaveProperty("phone");
  });

  it("still sends every column for a new row", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const next = structuredClone(previous);
    next.badges.push({
      ...next.badges[0]!,
      id: "badge-new",
      uid: "04aabbccdd",
    });

    await persistBundleToPrisma(next, previous);

    const [upsert] = upserts("badge");
    expect(upsert!.create).toMatchObject({ id: "badge-new", uid: "04aabbccdd" });
    const { id: _id, ...columns } = upsert!.create;
    expect(_id).toBe("badge-new");
    expect(upsert!.update).toEqual(columns);
  });

  it("a settings edit leaves the scholarship counters alone", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const next = structuredClone(previous);
    next.settings.contactEmail = "desk@example.org";

    await persistBundleToPrisma(next, previous);

    const [upsert] = upserts("orgSettings");
    expect(upsert!.update).toEqual({ contactEmail: "desk@example.org" });
  });

  it("writes the household link only for the user whose link changed", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    previous.users[1]!.householdPrimaryUserId = previous.users[0]!.id;
    const next = structuredClone(previous);
    next.users[1]!.displayName = "Renamed";
    next.users[2]!.householdPrimaryUserId = previous.users[0]!.id;

    await persistBundleToPrisma(next, previous);

    const links = calls.filter(
      (c) => c.model === "user" && c.method === "update",
    );
    expect(links.map((c) => c.args)).toEqual([
      {
        where: { id: next.users[2]!.id },
        data: { householdPrimaryUserId: previous.users[0]!.id },
      },
    ]);
  });
});

describe("createPrismaDataProvider", () => {
  it("a profile save from a stale bundle keeps a suspension and a membership change", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(MEMBER);

    // After this request loaded its bundle, staff suspend the member and a
    // Zeffy payment changes their membership.
    writeElsewhere("user", MEMBER, {
      role: "staff",
      status: "suspended",
      tier: "patron",
      shopAccess: false,
    });
    const before = { ...table("user").get(MEMBER)! };

    await provider.updateMemberProfile(MEMBER, PROFILE);

    const after = table("user").get(MEMBER)!;
    expect(after.lastName).toBe("Chen-Okafor");
    expect(after.emergencyContactName).toBe("Sam Chen");
    for (const column of STAFF_COLUMNS) {
      expect(after[column]).toBe(before[column]);
    }
  });

  it("a staff edit from a stale bundle keeps a profile change that landed first", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider("u-admin");

    writeElsewhere("user", MEMBER, { phone: "555-0199" });

    await provider.adminUpdateMemberStatus(MEMBER, "suspended", "u-admin");

    const after = table("user").get(MEMBER)!;
    expect(after.status).toBe("suspended");
    expect(after.phone).toBe("555-0199");
  });

  it("reads share one load for five seconds", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");

    await createPrismaDataProvider(MEMBER);
    await createPrismaDataProvider(MEMBER);
    expect(loads()).toBe(1);

    vi.setSystemTime(Date.now() + 5_001);
    await createPrismaDataProvider(MEMBER);
    expect(loads()).toBe(2);
  });

  it("a write loads its own bundle instead of the cached one", async () => {
    await seedDatabase();
    const { createPrismaDataProvider, takeBundleLoad } = await import(
      "./prisma-provider"
    );
    await createPrismaDataProvider(MEMBER);
    writeElsewhere("user", MEMBER, { status: "suspended" });

    const cached = await createPrismaDataProvider(MEMBER);
    expect((await cached.getMember(MEMBER))!.status).toBe("active");
    expect(takeBundleLoad()).toBe("cache");

    const fresh = await createPrismaDataProvider(MEMBER, { fresh: true });
    expect((await fresh.getMember(MEMBER))!.status).toBe("suspended");
    expect(takeBundleLoad()).toBe("fresh");
    expect(loads()).toBe(2);
  });

  it("a fresh load reports as an ordinary load when nothing was cached", async () => {
    await seedDatabase();
    const { createPrismaDataProvider, takeBundleLoad } = await import(
      "./prisma-provider"
    );

    await createPrismaDataProvider(MEMBER, { fresh: true });

    expect(takeBundleLoad()).toBe("bundle");
    expect(loads()).toBe(1);
  });

  it("a fresh load serves the reads that follow it", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");

    await createPrismaDataProvider(MEMBER, { fresh: true });
    await createPrismaDataProvider(MEMBER);

    expect(loads()).toBe(1);
  });

  it("a write does not wait on a load that started before it", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    let release = () => {};
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowRead = createPrismaDataProvider(MEMBER);
    hold = null;
    writeElsewhere("user", MEMBER, { status: "suspended" });

    const writer = await createPrismaDataProvider(MEMBER, { fresh: true });
    expect((await writer.getMember(MEMBER))!.status).toBe("suspended");

    release();
    await slowRead;
  });

  it("a load that started before a write cannot refill the cache", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    let release = () => {};
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowRead = createPrismaDataProvider(MEMBER);
    hold = null;

    const writer = await createPrismaDataProvider(MEMBER, { fresh: true });
    await writer.updateMemberProfile(MEMBER, PROFILE);
    release();
    await slowRead;

    const reader = await createPrismaDataProvider(MEMBER);
    expect((await reader.getMember(MEMBER))!.lastName).toBe("Chen-Okafor");
  });

  it("drops the cache when a save fails part-way", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const writer = await createPrismaDataProvider(MEMBER, { fresh: true });
    const before = loads();
    table("user").set = () => {
      throw new Error("D1 unavailable");
    };

    await expect(writer.updateMemberProfile(MEMBER, PROFILE)).rejects.toThrow(
      "D1 unavailable",
    );
    await createPrismaDataProvider(MEMBER);

    expect(loads()).toBe(before + 1);
  });
});

describe("loadBundleFromPrisma", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("leaves kiosk PIN bookkeeping for emails nobody has out of every request", async () => {
    // Anyone can post a wrong PIN for a made-up email, and each one is a row.
    // Loading them into the bundle would let a stranger grow every request.
    const { loadBundleFromPrisma } = await import("./prisma-provider");
    await loadBundleFromPrisma().catch(() => undefined);
    const load = calls.find((c) => c.model === "auditEvent" && c.method === "findMany");
    expect(load?.args).toEqual({
      where: {
        NOT: {
          OR: [
            { action: "workstation.pin_attempt" },
            { action: "workstation.pin_failed", subjectUserId: null },
          ],
        },
      },
    });
  });
});

describe("payments applied by the system", () => {
  const payment = {
    id: "pay-test-membership-1",
    object: "payment",
    created: 1_790_000_000,
    amount: 7500,
    currency: "usd",
    status: "succeeded",
    campaign_id: "camp-test-membership",
    campaign_type: "ticketing",
    campaign_category: "MembershipV2",
    buyer: { email: "new.member@example.org", first_name: "New", last_name: "Member" },
    items: [
      { id: "i1", type: "ticket", amount: 7500, rate_id: "rate-plus", rate_title: "Maker Plus" },
    ],
  } as never;

  it("saves the audit rows of a Zeffy membership payment without a made-up actor", async () => {
    // AuditEvent.actorId points at a User row, and D1 enforces that. The
    // payment code used "system:zeffy", which no user has, so every save of a
    // payment failed after the member was already changed.
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    const result = await provider.applyZeffyMembershipPayment(payment, undefined, {
      createIfMissing: true,
    });
    expect(result.status).toBe("applied");

    const saved = upserts("auditEvent");
    expect(saved.map((row) => row.create.action)).toContain("membership_applied_zeffy");
    for (const row of saved) {
      const actor = row.create.actorId as string | null;
      if (actor !== null) expect(table("user").has(actor), `actor ${actor}`).toBe(true);
      expect(String(actor)).not.toMatch(/^system:/);
    }
  });

  it("the same payment delivered again is a duplicate, not a second application", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const first = await createPrismaDataProvider(null, { fresh: true });
    await first.applyZeffyMembershipPayment(payment, undefined, { createIfMissing: true });
    const second = await createPrismaDataProvider(null, { fresh: true });
    const again = await second.applyZeffyMembershipPayment(payment, undefined, {
      createIfMissing: true,
    });
    expect(again.status).toBe("duplicate");
  });
});

describe("lists that have no table of their own", () => {
  // The staff directory, wishlist and tool champion terms used to be read
  // from fixture files on the live site, and every write to them was
  // refused. They are kept as SiteRecord rows now. Lobby promos and display
  // settings have tables of their own.
  function records(collection: string): Row[] {
    return [...table("siteRecord").values()]
      .filter((row) => row.collection === collection)
      .map((row) => JSON.parse(String(row.data)) as Row);
  }

  it("keeps a wishlist purchase report, and a later request sees it", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    const before = records("wishlistPurchaseReports").length;
    const catalog = await provider.getWishlistCatalog();
    const item = catalog.items.find((i) => i.status !== "fulfilled")!;
    await provider.reportWishlistPurchase({
      itemId: item.id,
      name: "Pat",
      email: "pat@example.com",
    });
    const stored = records("wishlistPurchaseReports");
    expect(stored).toHaveLength(before + 1);
    expect(stored.some((r) => r.itemId === item.id && r.name === "Pat")).toBe(true);

    const staff = await createPrismaDataProvider("u-admin", { fresh: true });
    const reports = await staff.adminListWishlistPurchaseReports();
    expect(reports.some((r) => r.itemId === item.id && r.name === "Pat")).toBe(true);
  });

  it("writes only the row that changed", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const person = (await admin.adminListPeople())[0]!;
    await admin.adminSavePerson({ ...person, roleTitle: "Shop Lead" });
    const written = upserts("siteRecord").map((u) => u.where.id);
    expect(written).toEqual([`people:${person.id}`]);
  });

  it("keeps a tool champion request", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    await admin.requestToolChampionTerm({ userId: "u-maya", machineId: "m-miter-saw" });
    expect(
      records("toolChampionTerms").some(
        (t) => t.userId === "u-maya" && t.machineId === "m-miter-saw",
      ),
    ).toBe(true);
  });

  it("leaves lobby promos and display settings to their own tables", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const promo = (await admin.listPromos())[0]!;
    await admin.savePromo({ ...promo, title: "Holiday hours" });
    await admin.saveDisplayConfig({ cadenceSeconds: 20 });
    expect(upserts("siteRecord")).toEqual([]);
    expect(records("promoSlides")).toEqual([]);
    expect(records("displayConfig")).toEqual([]);
  });

  it("reads the staff directory from the database, not from the fixture file", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const first = await createPrismaDataProvider(null, { fresh: true });
    const person = (await first.listPeople())[0]!;
    writeElsewhere("siteRecord", `people:${person.id}`, {
      data: JSON.stringify({ ...person, name: "Renamed In The Database" }),
    });
    const second = await createPrismaDataProvider(null, { fresh: true });
    expect((await second.listPeople()).map((p) => p.name)).toContain("Renamed In The Database");
  });

  it("keeps the machine rate card as one row and reads it back", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const before = await admin.getRateCard();
    await admin.adminSaveRateCard({ laserMemberHourlyCents: 1800 });
    expect(upserts("siteRecord").map((u) => u.where.id)).toEqual(["rateCard:default"]);
    expect(JSON.parse(String(table("siteRecord").get("rateCard:default")?.data))).toEqual({
      ...before,
      laserMemberHourlyCents: 1800,
    });

    const later = await createPrismaDataProvider(null, { fresh: true });
    expect((await later.getRateCard()).laserMemberHourlyCents).toBe(1800);
  });

  it("uses the default price for each rate card field the database has wrong", async () => {
    await seedDatabase();
    const { DEFAULT_RATE_CARD } = await import("@/lib/rate-card");
    table("siteRecord").set("rateCard:default", {
      id: "rateCard:default",
      collection: "rateCard",
      data: JSON.stringify({ laserMemberHourlyCents: 1800, cncMemberHourlyCents: "free", plasmaSetupCents: -1 }),
    });
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    expect(await provider.getRateCard()).toEqual({
      ...DEFAULT_RATE_CARD,
      laserMemberHourlyCents: 1800,
    });
  });

  it("is the default rate card when the database has none", async () => {
    await seedDatabase();
    table("siteRecord").delete("rateCard:default");
    const { DEFAULT_RATE_CARD } = await import("@/lib/rate-card");
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    expect(await provider.getRateCard()).toEqual(DEFAULT_RATE_CARD);
  });

  it("keeps the opening hours as one row and reads them back", async () => {
    await seedDatabase();
    const { DEFAULT_OPENING_HOURS } = await import("@/lib/opening-hours");
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const week = DEFAULT_OPENING_HOURS.map((d) => (d ? { ...d } : null));
    week[1] = { open: 630, close: 870 };
    await admin.adminSaveOpeningHours(week);
    expect(upserts("siteRecord").map((u) => u.where.id)).toEqual(["openingHours:default"]);
    expect(JSON.parse(String(table("siteRecord").get("openingHours:default")?.data))).toEqual(week);

    const later = await createPrismaDataProvider(null, { fresh: true });
    expect(await later.getOpeningHours()).toEqual(week);
  });

  it("uses the default hours for each day the database has wrong, and all of them when it has none", async () => {
    await seedDatabase();
    const { DEFAULT_OPENING_HOURS } = await import("@/lib/opening-hours");
    const stored = DEFAULT_OPENING_HOURS.map((d) => (d ? { ...d } : null)) as unknown[];
    stored[2] = { open: "one", close: 1200 };
    stored[6] = { open: 600, close: 720 };
    table("siteRecord").set("openingHours:default", {
      id: "openingHours:default",
      collection: "openingHours",
      data: JSON.stringify(stored),
    });
    const { createPrismaDataProvider, invalidateBundleCache } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    const read = await provider.getOpeningHours();
    expect(read[2]).toEqual(DEFAULT_OPENING_HOURS[2]);
    expect(read[6]).toEqual({ open: 600, close: 720 });

    table("siteRecord").delete("openingHours:default");
    invalidateBundleCache();
    const fresh = await createPrismaDataProvider(null, { fresh: true });
    expect(await fresh.getOpeningHours()).toEqual(DEFAULT_OPENING_HOURS);
  });

  it("shows nothing, not sample rows, when the database has none", async () => {
    await seedDatabase();
    for (const id of [...table("siteRecord").keys()]) {
      if (id.startsWith("people:")) table("siteRecord").delete(id);
    }
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    expect(await provider.listPeople()).toEqual([]);
  });
});

describe("removals staff make from the admin", () => {
  function deletes(model: string): string[] {
    return calls
      .filter((c) => c.model === model && c.method === "deleteMany")
      .flatMap((c) => (c.args as { where: { id: { in: string[] } } }).where.id.in);
  }

  it("really deletes a removed bounty, and only that one", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const [spam, keep] = await admin.adminListBounties();
    await admin.adminDeleteBounty(spam!.id);
    expect(deletes("bounty")).toEqual([spam!.id]);
    const later = await createPrismaDataProvider("u-admin", { fresh: true });
    const ids = (await later.adminListBounties()).map((b) => b.id);
    expect(ids).not.toContain(spam!.id);
    expect(ids).toContain(keep!.id);
  });

  it("keeps a hidden bounty in the database, marked hidden", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const bounty = (await admin.adminListBounties())[0]!;
    await admin.adminUpdateBounty(bounty.id, { hidden: true });
    expect(deletes("bounty")).toEqual([]);
    expect(table("bounty").get(bounty.id)?.deletedAt).toBeInstanceOf(Date);
    const later = await createPrismaDataProvider(null, { fresh: true });
    expect((await later.listBounties()).map((b) => b.id)).not.toContain(bounty.id);
  });

  it("really deletes a removed maintenance block", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const block = (await admin.adminListMaintenanceBlocks())[0]!;
    await admin.adminDeleteMaintenanceBlock(block.id);
    expect(deletes("maintenanceBlock")).toEqual([block.id]);
    const later = await createPrismaDataProvider("u-admin", { fresh: true });
    expect((await later.adminListMaintenanceBlocks()).map((b) => b.id)).not.toContain(block.id);
  });

  it("adds and removes area stewards as rows", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const area = (await admin.listInventoryAreas())[0]!;
    await admin.adminSetAreaStewards(area.id, ["u-maya", "u-quinn"]);
    const maya = (await admin.listAreaStewards()).find(
      (s) => s.areaId === area.id && s.userId === "u-maya",
    )!;
    expect(table("areaSteward").has(maya.id)).toBe(true);
    calls.length = 0;
    await admin.adminSetAreaStewards(area.id, ["u-quinn"]);
    expect(deletes("areaSteward")).toContain(maya.id);
    expect(table("areaSteward").has(maya.id)).toBe(false);
    const later = await createPrismaDataProvider("u-admin", { fresh: true });
    const after = (await later.listAreaStewards()).filter((s) => s.areaId === area.id);
    expect(after.map((s) => s.userId)).toEqual(["u-quinn"]);
  });
});

describe("the lobby display on the live site", () => {
  const PHOTO_ID = "22222222-2222-4222-8222-000000000001";

  it("keeps a promo slide a staff member saves", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const saved = await admin.savePromo({
      title: "Holiday market",
      body: "Sat 12 Dec, 10 to 4.",
      startsAt: "2026-11-01T00:00:00.000Z",
      endsAt: "2026-12-13T00:00:00.000Z",
    });
    expect(upserts("promoSlide").map((u) => u.create.title)).toEqual([
      "Holiday market",
    ]);

    const later = await createPrismaDataProvider(null, { fresh: true });
    expect((await later.listPromos()).map((p) => p.id)).toContain(saved.id);
    expect((await later.getDisplayFeed()).promos.map((p) => p.id)).toContain(
      saved.id,
    );
  });

  it("keeps display settings, writing only what changed", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    await admin.saveDisplayConfig({ cadenceSeconds: 20, motion: "calm" });

    const [write] = upserts("displayConfig");
    expect(write!.where).toEqual({ id: "default" });
    expect(Object.keys(write!.update).sort()).toEqual([
      "cadenceSeconds",
      "motion",
      "updatedAt",
    ]);

    const later = await createPrismaDataProvider(null, { fresh: true });
    expect(await later.getDisplayConfig()).toMatchObject({
      cadenceSeconds: 20,
      motion: "calm",
    });
  });

  it("reads the Find us slide back from saved settings", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    await admin.saveDisplayConfig({ panelOrder: ["findus", "upcoming"] });
    const later = await createPrismaDataProvider(null, { fresh: true });
    expect((await later.getDisplayConfig()).panelOrder).toEqual([
      "findus",
      "upcoming",
    ]);
  });

  it("reads the spotlight and community slides back from saved settings", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    await admin.saveDisplayConfig({ panelOrder: ["spotlight", "community"] });
    const later = await createPrismaDataProvider(null, { fresh: true });
    expect((await later.getDisplayConfig()).panelOrder).toEqual([
      "spotlight",
      "community",
    ]);
  });

  it("uses the default settings when the database has none, and creates them on save", async () => {
    await seedDatabase();
    table("displayConfig").clear();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const config = await admin.getDisplayConfig();
    expect(config).toMatchObject({ cadenceSeconds: 12, motion: "full" });
    expect(config.panelOrder).toHaveLength(10);

    await admin.saveDisplayConfig({ pinnedPanel: "upcoming" });
    expect(table("displayConfig").get("default")).toMatchObject({
      pinnedPanel: "upcoming",
      panelOrder: JSON.stringify(config.panelOrder),
    });
  });

  it("shows no sample promos or photos when the database has none", async () => {
    await seedDatabase();
    table("promoSlide").clear();
    table("displayPhoto").clear();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const feed = await (
      await createPrismaDataProvider(null, { fresh: true })
    ).getDisplayFeed();
    expect(feed.promos).toEqual([]);
    expect(feed.photos).toEqual([]);
  });

  it("keeps a photo's row, without the dev-only file path, and hides it once deleted", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    await admin.saveDisplayPhoto({
      id: PHOTO_ID,
      mimeType: "image/jpeg",
      caption: "Dovetail class",
      width: 1600,
      height: 1200,
    });
    const [write] = upserts("displayPhoto");
    expect(write!.create).toMatchObject({
      id: PHOTO_ID,
      caption: "Dovetail class",
      mimeType: "image/jpeg",
      width: 1600,
    });
    expect(write!.create).not.toHaveProperty("staticPath");

    const second = await createPrismaDataProvider("u-admin", { fresh: true });
    expect((await second.getDisplayFeed()).photos.map((p) => p.id)).toContain(
      PHOTO_ID,
    );
    await second.deleteDisplayPhoto(PHOTO_ID);
    const third = await createPrismaDataProvider(null, { fresh: true });
    expect((await third.getDisplayFeed()).photos.map((p) => p.id)).not.toContain(
      PHOTO_ID,
    );
  });

  it("keeps the rest of the site up when the display's own tables cannot be read", async () => {
    // Every page loads the same data. A problem with the lobby display's
    // tables must cost the display its extras, not take the portal down.
    await seedDatabase();
    broken.add("displayPhoto");
    broken.add("displayConfig");
    broken.add("promoSlide");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const provider = await createPrismaDataProvider(null, { fresh: true });
    const feed = await provider.getDisplayFeed();
    expect(feed.photos).toEqual([]);
    expect(feed.promos).toEqual([]);
    expect(feed.config).toMatchObject({ cadenceSeconds: 12, motion: "full" });
    expect(feed.membership.products.length).toBeGreaterThan(0);
  });
});
