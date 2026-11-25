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
/** The next `times` upserts on this model throw, as failed database writes would. */
let failUpserts: {
  model: string;
  times: number;
  /** Let this many writes through first. */
  after?: number;
  error?: Error;
} | null = null;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where?: { id?: any } & Record<string, unknown>;
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
        const email = (args?.where as { email?: string } | undefined)?.email;
        const row = email
          ? [...table(model).values()].find((r) => r.email === email)
          : table(model).get(String(args?.where?.id));
        return row ? { ...row } : null;
      },
      async upsert(args) {
        if (failUpserts && failUpserts.model === model && failUpserts.times > 0) {
          if ((failUpserts.after ?? 0) > 0) {
            failUpserts.after = (failUpserts.after ?? 0) - 1;
          } else {
            failUpserts.times -= 1;
            throw failUpserts.error ?? new Error("D1_ERROR: the write did not go through");
          }
        }
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
      async updateMany(args) {
        // The conditional write a claim is made with: only rows that match
        // every condition are changed, and the count says how many.
        const where = (args?.where ?? {}) as Record<string, unknown>;
        let count = 0;
        for (const [id, row] of table(model)) {
          const matches = Object.entries(where).every(([key, want]) => {
            const have = row[key] ?? null;
            if (want instanceof Date && have instanceof Date) return +want === +have;
            return have === (want ?? null);
          });
          if (!matches) continue;
          table(model).set(id, { ...row, ...args?.data });
          count += 1;
        }
        return { count };
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

describe("redemption codes on the live site", () => {
  const JORDAN = "u-jordan";
  const USED = "That code has already been used.";

  function claims() {
    return calls
      .filter((c) => c.model === "redemptionCode" && c.method === "updateMany")
      .map((c) => c.args as { where: Row; data: Row });
  }

  async function staffWithCode(input: Row = { kind: "credit", amountCents: 2500, quantity: 1 }) {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const [code] = await admin.adminCreateCodes(input as never);
    calls.length = 0;
    return { code: code!, createPrismaDataProvider };
  }

  it("saves a new code as a row, and reads it back for staff", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    expect(table("redemptionCode").get(code.id)).toMatchObject({
      code: code.code,
      kind: "credit",
      amountCents: 2500,
      redeemedAt: null,
      voidedAt: null,
    });
    const later = await createPrismaDataProvider("u-admin", { fresh: true });
    expect((await later.adminListCodes()).map((c) => c.id)).toContain(code.id);
  });

  it("claims the code with one conditional write before the credit is saved", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    const member = await createPrismaDataProvider(JORDAN, { fresh: true });
    await member.redeemCode(JORDAN, code.code);

    const [claim] = claims();
    expect(claim!.where).toEqual({ id: code.id, redeemedAt: null, voidedAt: null });
    expect(claim!.data).toMatchObject({ redeemedByUserId: JORDAN });
    const order = calls
      .filter(
        (c) =>
          c.method === "updateMany" ||
          (c.model === "creditLedgerEntry" && c.method === "upsert"),
      )
      .map((c) => `${c.model}.${c.method}`);
    expect(order[0]).toBe("redemptionCode.updateMany");
    expect(order).toContain("creditLedgerEntry.upsert");

    expect(table("creditLedgerEntry").get(`cl-code-${code.id}`)).toMatchObject({
      userId: JORDAN,
      kind: "gift_code",
      amountCents: 2500,
      sourcePaymentId: `code:${code.id}`,
    });
    expect(table("redemptionCode").get(code.id)?.redeemedByUserId).toBe(JORDAN);
  });

  it("grants nothing when another request claimed the code first", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    // Both requests load the code while it is still unused.
    const first = await createPrismaDataProvider(JORDAN, { fresh: true });
    const second = await createPrismaDataProvider("u-maya", { fresh: true });
    await first.redeemCode(JORDAN, code.code);
    calls.length = 0;

    await expect(second.redeemCode("u-maya", code.code)).rejects.toThrow(USED);
    expect(upserts("creditLedgerEntry")).toEqual([]);
    expect(upserts("auditEvent")).toEqual([]);
    expect(upserts("redemptionCode")).toEqual([]);
    expect(table("redemptionCode").get(code.id)?.redeemedByUserId).toBe(JORDAN);
    expect(table("creditLedgerEntry").get(`cl-code-${code.id}`)?.userId).toBe(JORDAN);
  });

  it("gives the same person one credit when their two presses race", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    const first = await createPrismaDataProvider(JORDAN, { fresh: true });
    const second = await createPrismaDataProvider(JORDAN, { fresh: true });
    await first.redeemCode(JORDAN, code.code);
    await expect(second.redeemCode(JORDAN, code.code)).rejects.toThrow(USED);
    const mine = [...table("creditLedgerEntry").values()].filter(
      (e) => e.sourcePaymentId === `code:${code.id}`,
    );
    expect(mine).toHaveLength(1);
  });

  it("tries the save again when it fails once, and the credit lands once", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    const member = await createPrismaDataProvider(JORDAN, { fresh: true });
    failUpserts = { model: "creditLedgerEntry", times: 1 };
    await member.redeemCode(JORDAN, code.code);
    expect(table("creditLedgerEntry").get(`cl-code-${code.id}`)?.userId).toBe(JORDAN);
    expect(table("redemptionCode").get(code.id)?.redeemedByUserId).toBe(JORDAN);
  });

  it("holds the code for that person when the save keeps failing, and never hands it to another", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const member = await createPrismaDataProvider(JORDAN, { fresh: true });
    failUpserts = { model: "creditLedgerEntry", times: 2 };
    await expect(member.redeemCode(JORDAN, code.code)).rejects.toThrow(/held for you/i);
    // Claimed, so a second person with the same code gets nothing.
    expect(table("redemptionCode").get(code.id)?.redeemedByUserId).toBe(JORDAN);
    const other = await createPrismaDataProvider("u-maya", { fresh: true });
    await expect(other.redeemCode("u-maya", code.code)).rejects.toThrow(USED);
    expect(table("creditLedgerEntry").has(`cl-code-${code.id}`)).toBe(false);
    // The log names the code by id, never by its text.
    expect(JSON.stringify(logged.mock.calls)).toContain(code.id);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(code.code);
    logged.mockRestore();
  });

  it("will not void a code that was redeemed while staff had the list open", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    const staff = await createPrismaDataProvider("u-admin", { fresh: true });
    const member = await createPrismaDataProvider(JORDAN, { fresh: true });
    await member.redeemCode(JORDAN, code.code);
    await expect(staff.adminVoidCode(code.id)).rejects.toThrow(/already been redeemed/i);
    expect(table("redemptionCode").get(code.id)?.voidedAt ?? null).toBeNull();
  });

  it("will not redeem a code that was voided while the member had the page open", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode();
    const member = await createPrismaDataProvider(JORDAN, { fresh: true });
    const staff = await createPrismaDataProvider("u-admin", { fresh: true });
    await staff.adminVoidCode(code.id);
    calls.length = 0;
    await expect(member.redeemCode(JORDAN, code.code)).rejects.toThrow(/not valid/i);
    expect(upserts("creditLedgerEntry")).toEqual([]);
  });

  it("keeps the end date of a gifted membership on the member", async () => {
    const { code, createPrismaDataProvider } = await staffWithCode({
      kind: "membership",
      tier: "community",
      months: 3,
      quantity: 1,
    });
    const member = await createPrismaDataProvider("u-alex", { fresh: true });
    await member.redeemCode("u-alex", code.code);
    expect(table("user").get("u-alex")).toMatchObject({
      status: "active",
      tier: "community",
      membershipEndsAt: new Date("2027-02-01T12:00:00.000Z"),
    });
    const later = await createPrismaDataProvider("u-alex", { fresh: true });
    expect((await later.getMember("u-alex"))?.membershipEndsAt).toBe("2027-02-01T12:00:00.000Z");
  });
});

describe("gift cards at the desk, on the live site", () => {
  const JORDAN = "u-jordan";
  const STAFF = "u-staff";

  function claims() {
    return calls
      .filter((c) => c.model === "redemptionCode" && c.method === "updateMany")
      .map((c) => c.args as { where: Row; data: Row });
  }

  async function shopWithCard() {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const [card] = await admin.adminCreateCodes({
      kind: "credit",
      amountCents: 2500,
      quantity: 1,
      numberAsCards: true,
      firstCardNumber: 14,
    });
    calls.length = 0;
    return { card: card!, createPrismaDataProvider };
  }

  it("saves the card number with the code and reads it back", async () => {
    const { card, createPrismaDataProvider } = await shopWithCard();
    expect(table("redemptionCode").get(card.id)).toMatchObject({ cardNumber: 14 });
    const later = await createPrismaDataProvider("u-admin", { fresh: true });
    expect((await later.adminListCodes()).find((c) => c.id === card.id)?.cardNumber).toBe(14);
  });

  it("claims the card for the member, with the staff member's name on it, before the credit is saved", async () => {
    const { card, createPrismaDataProvider } = await shopWithCard();
    const staff = await createPrismaDataProvider(STAFF, { fresh: true });
    await staff.adminRedeemCodeFor(JORDAN, "014");

    const [claim] = claims();
    expect(claim!.where).toEqual({ id: card.id, redeemedAt: null, voidedAt: null });
    expect(claim!.data).toMatchObject({
      redeemedByUserId: JORDAN,
      redeemedByStaffId: STAFF,
    });
    const order = calls
      .filter(
        (c) =>
          c.method === "updateMany" ||
          (c.model === "creditLedgerEntry" && c.method === "upsert"),
      )
      .map((c) => `${c.model}.${c.method}`);
    expect(order[0]).toBe("redemptionCode.updateMany");
    expect(table("creditLedgerEntry").get(`cl-code-${card.id}`)).toMatchObject({
      userId: JORDAN,
      amountCents: 2500,
    });
    expect(table("redemptionCode").get(card.id)).toMatchObject({
      redeemedByUserId: JORDAN,
      redeemedByStaffId: STAFF,
    });
  });

  it("grants nothing at the desk when the member redeemed the code themselves a moment earlier", async () => {
    const { card, createPrismaDataProvider } = await shopWithCard();
    // Both requests load the card while it is still unused.
    const member = await createPrismaDataProvider(JORDAN, { fresh: true });
    const staff = await createPrismaDataProvider(STAFF, { fresh: true });
    await member.redeemCode(JORDAN, card.code);
    calls.length = 0;

    await expect(staff.adminRedeemCodeFor("u-alex", "014")).rejects.toThrow(
      "That code has already been used.",
    );
    expect(upserts("creditLedgerEntry")).toEqual([]);
    expect(upserts("auditEvent")).toEqual([]);
    expect(table("redemptionCode").get(card.id)).toMatchObject({
      redeemedByUserId: JORDAN,
      redeemedByStaffId: null,
    });
    expect(table("creditLedgerEntry").get(`cl-code-${card.id}`)?.userId).toBe(JORDAN);
  });

  it("lets one of two staff win when both redeem the same card", async () => {
    const { card, createPrismaDataProvider } = await shopWithCard();
    const first = await createPrismaDataProvider(STAFF, { fresh: true });
    const second = await createPrismaDataProvider("u-admin", { fresh: true });
    const results = await Promise.allSettled([
      first.adminRedeemCodeFor(JORDAN, "014"),
      second.adminRedeemCodeFor("u-alex", "014"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const ledger = [...table("creditLedgerEntry").values()].filter(
      (e) => e.sourcePaymentId === `code:${card.id}`,
    );
    expect(ledger).toHaveLength(1);
  });

  it("leaves no part of a batch behind when a card number was taken by another batch meanwhile", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const admin = await createPrismaDataProvider("u-admin", { fresh: true });
    const before = table("redemptionCode").size;
    const audits = table("auditEvent").size;
    // The database refuses the third card: its number now belongs to a card
    // another member of staff made after this request loaded its data.
    failUpserts = {
      model: "redemptionCode",
      times: 1,
      after: 2,
      error: Object.assign(
        new Error(
          "\nInvalid `prisma.redemptionCode.upsert()` invocation:\n\n\nUnique constraint failed on the fields: (`cardNumber`)",
        ),
        { name: "PrismaClientKnownRequestError", code: "P2002" },
      ),
    };
    await expect(
      admin.adminCreateCodes({
        kind: "credit",
        amountCents: 2500,
        quantity: 4,
        numberAsCards: true,
        firstCardNumber: 200,
      }),
    ).rejects.toThrow(
      "Another batch took one of those card numbers a moment ago. No codes were made. Check the list and try again.",
    );
    expect(table("redemptionCode").size).toBe(before);
    expect(table("auditEvent").size).toBe(audits);
  });

  it("saves a recipient staff add under the email a sign-in link looks them up by", async () => {
    await seedDatabase();
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const staff = await createPrismaDataProvider(STAFF, { fresh: true });
    const pat = await staff.adminCreateMember({
      firstName: "Pat",
      lastName: "Rivera",
      email: " Pat.Rivera@Example.com ",
    });
    expect(table("user").get(pat.id)).toMatchObject({
      email: "pat.rivera@example.com",
      status: "pending",
      shopAccess: false,
      role: "member",
    });

    // Auth.js asks the adapter for the user by the normalised address when a
    // sign-in link is opened. Finding this row is what makes it sign them in
    // as the member staff added, where no row would make a second one.
    const { PrismaAdapter } = await import("@auth/prisma-adapter");
    const { prisma } = await import("@/lib/db");
    const { normalizeSignInEmail } = await import("@/lib/sign-in-email");
    const adapter = PrismaAdapter(prisma as never);
    const found = await adapter.getUserByEmail!(normalizeSignInEmail("Pat.Rivera@example.com"));
    expect(found?.id).toBe(pat.id);
    expect([...table("user").values()].filter((u) => u.email === "pat.rivera@example.com")).toHaveLength(1);
  });
});


describe("the public equipment switch on the live site", () => {
  it("saves the switch as its own column and a later request reads it", async () => {
    await seedDatabase();
    expect(table("inventoryItem").get("inv-prusa")?.showPublicly).toBe(true);
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const staff = await createPrismaDataProvider("u-staff", { fresh: true });
    await staff.updateInventoryItem("u-staff", "inv-prusa", { showPublicly: false });

    const [write] = upserts("inventoryItem");
    expect(write!.where).toEqual({ id: "inv-prusa" });
    expect(Object.keys(write!.update).sort()).toEqual(["showPublicly", "updatedAt"]);
    expect(write!.update.showPublicly).toBe(false);

    const visitor = await createPrismaDataProvider(null, { fresh: true });
    const names = (await visitor.listPublicEquipment()).map((i) => i.name);
    expect(names).not.toContain("Prusa MK4");
    expect(names).toContain("Orbital sander");
  });

  it("shows an item whose row has no value for the switch", async () => {
    await seedDatabase();
    // A row as it was before the column existed.
    const row = table("inventoryItem").get("inv-prusa")!;
    delete row.showPublicly;
    const { createPrismaDataProvider } = await import("./prisma-provider");
    const visitor = await createPrismaDataProvider(null, { fresh: true });
    expect((await visitor.listPublicEquipment()).map((i) => i.name)).toContain("Prusa MK4");
  });
});
