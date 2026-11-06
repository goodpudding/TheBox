import { describe, expect, it } from "vitest";
import { changedRows, sliceChangedBundle } from "./persist-delta";
import { cloneFixtures, loadFixtures } from "./load-fixtures";

describe("changedRows", () => {
  it("returns only new or mutated ids", () => {
    const prev = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ];
    const next = [
      { id: "a", n: 1 },
      { id: "b", n: 3 },
      { id: "c", n: 4 },
    ];
    expect(changedRows(prev, next)).toEqual([
      { id: "b", n: 3 },
      { id: "c", n: 4 },
    ]);
  });

  it("treats missing previous as all-new", () => {
    expect(changedRows(undefined, [{ id: "a" }])).toEqual([{ id: "a" }]);
  });
});

describe("sliceChangedBundle", () => {
  it("does not mark an unchanged fixture bundle as dirty", () => {
    const bundle = cloneFixtures(loadFixtures());
    const sliced = sliceChangedBundle(bundle, structuredClone(bundle));
    expect(sliced.empty).toBe(true);
    expect(sliced.bundle.users).toEqual([]);
    expect(sliced.bundle.creditLedgerEntries).toEqual([]);
  });

  it("keeps only the mutated user", () => {
    const previous = cloneFixtures(loadFixtures());
    const next = structuredClone(previous);
    const maya = next.users.find((u) => u.id === "u-maya");
    expect(maya).toBeTruthy();
    maya!.displayName = "Maya Chen (desk)";
    const sliced = sliceChangedBundle(previous, next);
    expect(sliced.empty).toBe(false);
    expect(sliced.bundle.users.map((u) => u.id)).toEqual(["u-maya"]);
    expect(sliced.bundle.machines).toEqual([]);
  });

  it("reports a deleted question as removed and nothing else as dirty", () => {
    const previous = cloneFixtures(loadFixtures());
    const next = structuredClone(previous);
    const [question] = next.questions.splice(0, 1);
    expect(question).toBeTruthy();
    const sliced = sliceChangedBundle(previous, next);
    expect(sliced.empty).toBe(false);
    expect(sliced.removed).toEqual({ questions: [question!.id] });
    expect(sliced.settingsChanged).toBe(false);
    expect(sliced.bundle.questions).toEqual([]);
    expect(sliced.bundle.users).toEqual([]);
  });

  it("a settings-only change carries no user rows", () => {
    const previous = cloneFixtures(loadFixtures());
    const next = structuredClone(previous);
    next.settings.orgName = "The Box (renamed)";
    const sliced = sliceChangedBundle(previous, next);
    expect(sliced.settingsChanged).toBe(true);
    expect(sliced.bundle.users).toEqual([]);
    expect(sliced.removed).toEqual({});
  });
});
