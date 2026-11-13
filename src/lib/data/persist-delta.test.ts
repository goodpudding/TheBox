import { describe, expect, it } from "vitest";
import {
  changedColumns,
  changedRows,
  shouldPersistAfter,
  sliceChangedBundle,
} from "./persist-delta";
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

describe("changedColumns", () => {
  it("returns only the columns whose value differs", () => {
    const prev = { id: "a", name: "Maya", status: "active", tier: null };
    const next = { id: "a", name: "Maya C", status: "active", tier: null };
    expect(changedColumns(prev, next)).toEqual({ name: "Maya C" });
  });

  it("compares dates by instant", () => {
    const prev = { id: "a", at: new Date("2026-01-01T00:00:00Z"), end: null };
    const same = { id: "a", at: new Date("2026-01-01T00:00:00Z"), end: null };
    expect(changedColumns(prev, same)).toEqual({});
    const moved = { id: "a", at: new Date("2026-01-02T00:00:00Z"), end: null };
    expect(changedColumns(prev, moved)).toEqual({ at: moved.at });
  });

  it("sends a column that was cleared or newly set", () => {
    const set = new Date("2026-01-01T00:00:00Z");
    expect(
      changedColumns({ id: "a", phone: "555", at: null }, { id: "a", phone: null, at: set }),
    ).toEqual({ phone: null, at: set });
  });

  it("never sends the id", () => {
    expect(changedColumns({ id: "a", n: 1 }, { id: "b", n: 1 })).toEqual({});
  });
});

describe("shouldPersistAfter", () => {
  it("treats lookups as reads and everything else as a write", () => {
    for (const name of [
      "getMember",
      "listClasses",
      "adminListMembers",
      "pendingInventoryCount",
      "findInventoryBySerial",
      "findBookingByZeffyPaymentId",
      "setCurrentUserId",
    ]) {
      expect(shouldPersistAfter(name), name).toBe(false);
    }
    for (const name of ["updateMemberProfile", "book", "reserve", "adminUpdateSettings"]) {
      expect(shouldPersistAfter(name), name).toBe(true);
    }
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
