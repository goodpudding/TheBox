import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneFixtures, loadFixtures } from "./load-fixtures";

const calls: Array<{ model: string; method: string; args: unknown }> = [];

vi.mock("@/lib/db", () => {
  const delegate = (model: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: unknown) => {
          calls.push({ model, method, args });
          return { count: 0 };
        },
      },
    );
  return {
    prisma: new Proxy({}, { get: (_t, model: string) => delegate(model) }),
  };
});

describe("persistBundleToPrisma", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("keeps defaultInstructorId on a settings-only save", async () => {
    const { persistBundleToPrisma } = await import("./prisma-provider");
    const previous = cloneFixtures(loadFixtures());
    const instructor = previous.users[0]!;
    previous.settings.defaultInstructorId = instructor.id;
    const next = structuredClone(previous);
    next.settings.orgName = "The Box (renamed)";

    await persistBundleToPrisma(next, previous);

    const upsert = calls.find(
      (c) => c.model === "orgSettings" && c.method === "upsert",
    );
    expect(upsert).toBeTruthy();
    const args = upsert!.args as {
      create: { defaultInstructorId: string | null };
      update: { defaultInstructorId: string | null };
    };
    expect(args.update.defaultInstructorId).toBe(instructor.id);
    expect(args.create.defaultInstructorId).toBe(instructor.id);
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
});
