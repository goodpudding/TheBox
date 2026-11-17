import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in check against a stand-in for the two tables it reads. The
 * stand-in applies `where` and `data` the way the database does, one
 * statement at a time, which is what the attempt count relies on.
 */

type PasswordRow = {
  userId: string;
  hash: string;
  failedCount: number;
  windowStartedAt: Date | null;
  setAt: Date;
};
type UserRow = { id: string; email: string; displayName: string; deletedAt: Date | null };

const db = vi.hoisted(() => ({
  users: [] as UserRow[],
  passwords: new Map<string, PasswordRow>(),
}));
const verifyPassword = vi.hoisted(() => vi.fn());
const spendPasswordCheck = vi.hoisted(() => vi.fn());

type Where = {
  userId: string;
  hash?: string;
  failedCount?: { lt?: number; gt?: number };
  OR?: { windowStartedAt: null | { lt: Date } }[];
};

function matches(row: PasswordRow, where: Where): boolean {
  if (row.userId !== where.userId) return false;
  if (where.hash !== undefined && row.hash !== where.hash) return false;
  if (where.failedCount?.lt !== undefined && !(row.failedCount < where.failedCount.lt)) return false;
  if (where.failedCount?.gt !== undefined && !(row.failedCount > where.failedCount.gt)) return false;
  if (where.OR) {
    return where.OR.some(({ windowStartedAt }) =>
      windowStartedAt === null
        ? row.windowStartedAt === null
        : row.windowStartedAt !== null && row.windowStartedAt < windowStartedAt.lt,
    );
  }
  return true;
}

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: async ({ where }: { where: { email: string; deletedAt: null } }) => {
        const user = db.users.find((u) => u.email === where.email && u.deletedAt === null);
        if (!user) return null;
        const password = db.passwords.get(user.id);
        return { ...user, password: password ? { hash: password.hash } : null };
      },
    },
    userPassword: {
      updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = db.passwords.get(where.userId);
        if (!row || !matches(row, where)) return { count: 0 };
        for (const [field, value] of Object.entries(data)) {
          const step = value as { increment?: number; decrement?: number } | null;
          if (field === "failedCount" && step && typeof step === "object") {
            row.failedCount += (step.increment ?? 0) - (step.decrement ?? 0);
          } else {
            (row as Record<string, unknown>)[field] = value;
          }
        }
        return { count: 1 };
      },
      upsert: async ({ where, create, update }: {
        where: { userId: string };
        create: PasswordRow;
        update: Partial<PasswordRow>;
      }) => {
        const row = db.passwords.get(where.userId);
        if (row) Object.assign(row, update);
        else db.passwords.set(where.userId, { ...create });
      },
    },
  },
}));

vi.mock("./password", async () => {
  const actual = await vi.importActual<typeof import("./password")>("./password");
  return {
    ...actual,
    verifyPassword: (...args: unknown[]) => verifyPassword(...args),
    spendPasswordCheck: (...args: unknown[]) => spendPasswordCheck(...args),
  };
});

const NOW = 1_800_000_000_000;
const MIN = 60 * 1000;
const MAYA: UserRow = { id: "u-maya", email: "maya@example.com", displayName: "Maya Chen", deletedAt: null };
const RIGHT = "plywood-otter-42";

async function load() {
  return import("./password-sign-in");
}

async function signIn(password: string, now = NOW, email = MAYA.email) {
  const { checkPasswordSignIn } = await load();
  return checkPasswordSignIn(email, password, now);
}

function givePassword(user: UserRow, hash = "scrypt:16384:8:1:00112233445566778899aabbccddeeff:" + "ab".repeat(32)) {
  db.passwords.set(user.id, {
    userId: user.id,
    hash,
    failedCount: 0,
    windowStartedAt: null,
    setAt: new Date(NOW - 24 * 60 * MIN),
  });
}

describe("checkPasswordSignIn", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db.users = [{ ...MAYA }];
    db.passwords.clear();
    verifyPassword.mockReset();
    spendPasswordCheck.mockReset();
    verifyPassword.mockImplementation(async (password: string) => password === RIGHT);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("signs in the member the email and password belong to", async () => {
    givePassword(MAYA);
    expect(await signIn(RIGHT)).toEqual({ id: "u-maya", email: "maya@example.com", name: "Maya Chen" });
    expect(db.passwords.get("u-maya")?.failedCount).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("finds the member however the address is typed", async () => {
    givePassword(MAYA);
    expect((await signIn(RIGHT, NOW, "  Maya@Example.COM "))?.id).toBe("u-maya");
  });

  it("answers the same, after the same work, for every way of failing", async () => {
    // No such member, a member with no password, and a removed member.
    expect(await signIn(RIGHT, NOW, "nobody@example.com")).toBeNull();
    expect(await signIn(RIGHT)).toBeNull();
    givePassword(MAYA);
    db.users[0].deletedAt = new Date(NOW - MIN);
    expect(await signIn(RIGHT)).toBeNull();
    expect(spendPasswordCheck).toHaveBeenCalledTimes(3);
    expect(verifyPassword).not.toHaveBeenCalled();

    // A wrong password does one real check instead.
    db.users[0].deletedAt = null;
    expect(await signIn("not-the-password")).toBeNull();
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(spendPasswordCheck).toHaveBeenCalledTimes(3);
  });

  it("never writes the address or the password to the log", async () => {
    givePassword(MAYA);
    await signIn("not-the-password");
    await signIn(RIGHT, NOW, "nobody@example.com");
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain('"refused":"wrong"');
    expect(logged).toContain('"refused":"unknown"');
    expect(logged).not.toContain("maya");
    expect(logged).not.toContain("nobody");
    expect(logged).not.toContain("not-the-password");
  });

  it("turns away input that is not one address and one password", async () => {
    givePassword(MAYA);
    const { checkPasswordSignIn } = await load();
    const bad: [unknown, unknown][] = [
      [undefined, RIGHT],
      [MAYA.email, undefined],
      [MAYA.email, ""],
      [MAYA.email, ["a", "b"]],
      [{ contains: "maya" }, RIGHT],
      ["Maya <maya@example.com>", RIGHT],
      ["not an address", RIGHT],
      [MAYA.email, "x".repeat(801)],
    ];
    for (const [email, password] of bad) {
      expect(await checkPasswordSignIn(email, password, NOW), JSON.stringify(email)).toBeNull();
    }
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(spendPasswordCheck).not.toHaveBeenCalled();
  });

  it("stops checking after five wrong passwords, even the right one", async () => {
    givePassword(MAYA);
    for (let i = 0; i < 5; i += 1) {
      expect(await signIn(`wrong-guess-${i}`, NOW + i * 1000)).toBeNull();
    }
    expect(verifyPassword).toHaveBeenCalledTimes(5);
    expect(await signIn(RIGHT, NOW + 6000)).toBeNull();
    expect(await signIn("wrong-guess-6", NOW + 7000)).toBeNull();
    // Neither was looked at, and a refused try does not make the wait longer.
    expect(verifyPassword).toHaveBeenCalledTimes(5);
    expect(spendPasswordCheck).toHaveBeenCalledTimes(2);
    expect(db.passwords.get("u-maya")?.failedCount).toBe(5);
    expect(warn.mock.calls.flat().join(" ")).toContain('"refused":"locked"');
  });

  it("lets the member back in once the window has passed", async () => {
    givePassword(MAYA);
    for (let i = 0; i < 5; i += 1) await signIn(`wrong-guess-${i}`, NOW);
    expect(await signIn(RIGHT, NOW + 15 * MIN - 1)).toBeNull();
    expect((await signIn(RIGHT, NOW + 15 * MIN + 1))?.id).toBe("u-maya");
    expect(db.passwords.get("u-maya")?.failedCount).toBe(0);
  });

  it("checks five at most when many guesses arrive together", async () => {
    givePassword(MAYA);
    // Every check is held open, so all thirty requests are in flight at once.
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    verifyPassword.mockImplementation(async () => {
      await held;
      return false;
    });
    const burst = Array.from({ length: 30 }, (_, i) => signIn(`wrong-guess-${i}`, NOW + i));
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    expect((await Promise.all(burst)).every((result) => result === null)).toBe(true);
    expect(verifyPassword).toHaveBeenCalledTimes(5);
  });

  it("does not hand someone guessing five more tries each time the member signs in", async () => {
    givePassword(MAYA);
    for (let i = 0; i < 4; i += 1) await signIn(`wrong-guess-${i}`, NOW);
    // The member signs in. Their own attempt is given back, the four stay.
    expect((await signIn(RIGHT, NOW + MIN))?.id).toBe("u-maya");
    expect(db.passwords.get("u-maya")?.failedCount).toBe(4);
    expect(await signIn("wrong-guess-4", NOW + 2 * MIN)).toBeNull();
    expect(await signIn("wrong-guess-5", NOW + 3 * MIN)).toBeNull();
    expect(verifyPassword).toHaveBeenCalledTimes(6);
  });

  it("re-saves a password stored with older settings when its owner signs in", async () => {
    const old = "scrypt:4096:8:1:00112233445566778899aabbccddeeff:" + "ab".repeat(32);
    givePassword(MAYA, old);
    expect((await signIn(RIGHT))?.id).toBe("u-maya");
    const saved = db.passwords.get("u-maya")?.hash ?? "";
    expect(saved).not.toBe(old);
    expect(saved).toMatch(/^scrypt:16384:8:1:/);
  });
});

describe("savePassword", () => {
  beforeEach(() => {
    db.users = [{ ...MAYA }];
    db.passwords.clear();
    verifyPassword.mockReset();
    verifyPassword.mockImplementation(async (password: string) => password === RIGHT);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("stores a hash, never the password", async () => {
    const { savePassword } = await load();
    await savePassword("u-maya", RIGHT, NOW);
    const row = db.passwords.get("u-maya");
    expect(row?.hash).toMatch(/^scrypt:16384:8:1:[0-9a-f]+:[0-9a-f]+$/);
    expect(JSON.stringify(row)).not.toContain(RIGHT);
    expect(row?.setAt).toEqual(new Date(NOW));
  });

  it("lets a locked-out member straight back in with the new password", async () => {
    const { savePassword } = await load();
    givePassword(MAYA);
    for (let i = 0; i < 5; i += 1) await signIn(`wrong-guess-${i}`, NOW);
    expect(await signIn(RIGHT, NOW + 1000)).toBeNull();
    await savePassword("u-maya", RIGHT, NOW + 2000);
    expect(db.passwords.get("u-maya")?.failedCount).toBe(0);
    expect((await signIn(RIGHT, NOW + 3000))?.id).toBe("u-maya");
  });
});
