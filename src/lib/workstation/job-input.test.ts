import { describe, expect, it } from "vitest";
import { parseJobRequest } from "./job-input";

describe("parseJobRequest", () => {
  it("keeps the usage numbers a desk sends", () => {
    expect(
      parseJobRequest({ machineId: "m-bambu", filamentGrams: 42.5, note: " benchy " }),
    ).toEqual({
      ok: true,
      job: {
        machineId: "m-bambu",
        filamentGrams: 42.5,
        prints: null,
        runtimeSeconds: null,
        note: "benchy",
      },
    });
  });

  it("drops a client-supplied filament price so the member cannot set their own rate", () => {
    const parsed = parseJobRequest({
      machineId: "m-bambu",
      filamentGrams: 500,
      filamentCentsPerKg: 0,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.job).not.toHaveProperty("filamentCentsPerKg");
  });

  it("requires a machine id", () => {
    expect(parseJobRequest({ filamentGrams: 5 })).toMatchObject({ ok: false });
    expect(parseJobRequest(null)).toMatchObject({ ok: false });
    expect(parseJobRequest({ machineId: 7 })).toMatchObject({ ok: false });
  });

  it.each([
    ["negative grams", { filamentGrams: -5 }],
    ["text grams", { filamentGrams: "lots" }],
    ["infinite run time", { runtimeSeconds: Number.POSITIVE_INFINITY }],
    ["NaN prints", { prints: Number.NaN }],
    ["absurd grams", { filamentGrams: 5_000_000 }],
    ["absurd run time", { runtimeSeconds: 10_000_000 }],
    ["absurd prints", { sheets: 100_000 }],
  ])("rejects %s", (_label, extra) => {
    expect(parseJobRequest({ machineId: "m-1", ...extra })).toMatchObject({
      ok: false,
    });
  });

  it("reads sheets as prints and trims a long note", () => {
    const parsed = parseJobRequest({
      machineId: "m-sub",
      sheets: 3,
      note: "n".repeat(900),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.job.prints).toBe(3);
      expect(parsed.job.note?.length).toBe(200);
    }
  });
});
