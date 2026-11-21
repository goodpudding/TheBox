/**
 * What the shop charges today, pinned case by case.
 *
 * Written before the rates moved out of constants and into a rate card staff
 * can edit. With nothing edited, every number here must stay exactly as it
 * is: this file passes unchanged before and after that change.
 */
import { describe, expect, it } from "vitest";
import {
  billingFor,
  billedMinutesFromSeconds,
  deskChargeHint,
  machineBillingMode,
  quoteMachineJob,
  type JobPayer,
} from "./credits";

const laser = { id: "m-laser", name: "Glowforge Laser", area: "laser" as const };
const cnc = { id: "m-cnc", name: "Shapeoko CNC", area: "woodshop" as const };
const plasma = { id: "m-plasma", name: "Langmuir CNC Plasma", area: "cnc_plasma" as const };
const printer = { id: "m-printer", name: "Bambu A1", area: "3d_printing" as const };
const sublimation = { id: "m-sub", name: "Sawgrass Printer", area: "sublimation" as const };
const tableSaw = { id: "m-saw", name: "Table Saw", area: "woodshop" as const };
const vinyl = { id: "m-vinyl-cutter", name: "Vinyl Cutter", area: "textiles_vinyl" as const };
const sewing = { id: "m-sew", name: "Sewing Machine", area: "textiles_vinyl" as const };
const drill = { id: "m-drill", name: "Drill Press", area: "hand_tools" as const };

const member: JobPayer = { tier: "maker", shopAccess: true, status: "active" };
const dayPass: JobPayer = { tier: "day", shopAccess: true, status: "active" };
const lapsed: JobPayer = { tier: "maker", shopAccess: true, status: "lapsed" };
const noShop: JobPayer = { tier: "friend", shopAccess: false, status: "active" };
const unlimited: JobPayer = { tier: "unlimited", shopAccess: true, status: "active" };

/** A weekday with no plasma waiver, the last Saturday of October 2026, and the Sunday after. */
const ORDINARY = new Date(2026, 9, 15);
const LAST_SATURDAY = new Date(2026, 9, 31);
const SUNDAY_AFTER = new Date(2026, 10, 1);

const minutes = (n: number) => n * 60;

describe("run-time jobs", () => {
  it.each([
    // machine, payer, seconds, date, billed cents
    ["laser member 1 min → minimum", laser, member, 60, ORDINARY, 500],
    ["laser member 20 min, exactly the minimum", laser, member, minutes(20), ORDINARY, 500],
    ["laser member 21 min rounds up to 25", laser, member, minutes(21), ORDINARY, 625],
    ["laser member 35 min", laser, member, minutes(35), ORDINARY, 875],
    ["laser member 40 min", laser, member, minutes(40), ORDINARY, 1000],
    ["laser member 1 hr", laser, member, minutes(60), ORDINARY, 1500],
    ["laser member 61 min rounds up to 65", laser, member, minutes(61), ORDINARY, 1625],
    ["laser day pass 5 min → minimum", laser, dayPass, minutes(5), ORDINARY, 500],
    ["laser day pass 1 hr", laser, dayPass, minutes(60), ORDINARY, 2500],
    ["laser lapsed member pays the non-member rate", laser, lapsed, minutes(60), ORDINARY, 2500],
    ["laser no shop access pays the non-member rate", laser, noShop, minutes(60), ORDINARY, 2500],
    ["laser unlimited is $0", laser, unlimited, minutes(60), ORDINARY, 0],
    ["cnc member 1 min → minimum", cnc, member, 60, ORDINARY, 1000],
    ["cnc member 1 hr", cnc, member, minutes(60), ORDINARY, 1000],
    ["cnc member 2 hr", cnc, member, minutes(120), ORDINARY, 2000],
    ["cnc day pass 30 min", cnc, dayPass, minutes(30), ORDINARY, 1000],
    ["cnc day pass 1 hr", cnc, dayPass, minutes(60), ORDINARY, 2000],
    ["plasma member 15 min with setup", plasma, member, minutes(15), ORDINARY, 5375],
    ["plasma member 15 min, last Saturday", plasma, member, minutes(15), LAST_SATURDAY, 375],
    ["plasma member 15 min, Sunday after", plasma, member, minutes(15), SUNDAY_AFTER, 375],
    ["plasma day pass 1 hr with setup", plasma, dayPass, minutes(60), ORDINARY, 7500],
    ["plasma day pass 1 hr, last Saturday", plasma, dayPass, minutes(60), LAST_SATURDAY, 2500],
    ["plasma unlimited is $0", plasma, unlimited, minutes(60), ORDINARY, 0],
    ["table saw is included", tableSaw, member, minutes(60), ORDINARY, 0],
    ["drill press is included", drill, dayPass, minutes(60), ORDINARY, 0],
    ["sewing is included", sewing, member, minutes(60), ORDINARY, 0],
    ["vinyl cutter is included", vinyl, dayPass, minutes(60), ORDINARY, 0],
  ] as const)("%s", (_label, machine, payer, runtimeSeconds, at, cents) => {
    const quote = quoteMachineJob({ machine, payer, runtimeSeconds, at });
    expect(quote.billedCents).toBe(cents);
  });

  it("rounds run time up to five minutes", () => {
    expect([0, 1, 60, 299, 300, 301, 3600, 3601].map(billedMinutesFromSeconds)).toEqual([
      0, 5, 5, 5, 5, 10, 60, 65,
    ]);
  });

  it("keeps the list price beside an unlimited member's $0", () => {
    const quote = quoteMachineJob({ machine: laser, payer: unlimited, runtimeSeconds: 3600, at: ORDINARY });
    expect(quote).toMatchObject({ billedCents: 0, listCents: 1500, unlimited: true });
  });

  it("says when the minimum or the plasma setup applied", () => {
    expect(
      quoteMachineJob({ machine: laser, payer: member, runtimeSeconds: 60, at: ORDINARY }),
    ).toMatchObject({ minimumCents: 500, minimumApplied: true, minutesBilled: 5, note: "Glowforge Laser · 5 min" });
    expect(
      quoteMachineJob({ machine: laser, payer: member, runtimeSeconds: minutes(20), at: ORDINARY }),
    ).toMatchObject({ minimumApplied: false });
    expect(
      quoteMachineJob({ machine: plasma, payer: member, runtimeSeconds: minutes(15), at: ORDINARY }),
    ).toMatchObject({ setupCents: 5000, setupWaived: false, note: "Langmuir CNC Plasma · 15 min · setup" });
    expect(
      quoteMachineJob({ machine: plasma, payer: member, runtimeSeconds: minutes(15), at: LAST_SATURDAY }),
    ).toMatchObject({ setupCents: 0, setupWaived: true, note: "Langmuir CNC Plasma · 15 min · setup waived" });
  });
});

describe("3D prints by the gram", () => {
  it.each([
    ["member 50 g → minimum", member, 50, 100],
    ["member 64 g is exactly the minimum", member, 64, 100],
    ["member 65 g", member, 65, 101],
    ["member 100 g", member, 100, 156],
    ["member 1 kg", member, 1000, 1560],
    ["day pass 50 g → minimum", dayPass, 50, 500],
    ["day pass 400 g", dayPass, 400, 624],
    ["lapsed member 50 g → non-member minimum", lapsed, 50, 500],
    ["unlimited 500 g is $0", unlimited, 500, 0],
  ] as const)("%s", (_label, payer, filamentGrams, cents) => {
    expect(quoteMachineJob({ machine: printer, payer, filamentGrams }).billedCents).toBe(cents);
  });

  it("reports the price per gram and the list price", () => {
    const quote = quoteMachineJob({ machine: printer, payer: unlimited, filamentGrams: 500 });
    expect(quote.listCents).toBe(780);
    expect(quote.centsPerGram).toBeCloseTo(1.56, 10);
    expect(quote.note).toBe("Bambu A1 · 500 g · Unlimited $0");
  });

  it("charges nothing with no grams", () => {
    expect(quoteMachineJob({ machine: printer, payer: member, filamentGrams: 0 }).billedCents).toBe(0);
  });
});

describe("sublimation by the print", () => {
  it.each([
    ["member 1 print", member, 1, 100],
    ["member 3 prints", member, 3, 300],
    ["day pass 3 prints", dayPass, 3, 600],
    ["unlimited 3 prints is $0", unlimited, 3, 0],
    ["no prints", member, 0, 0],
  ] as const)("%s", (_label, payer, prints, cents) => {
    expect(quoteMachineJob({ machine: sublimation, payer, prints }).billedCents).toBe(cents);
  });
});

describe("what each machine bills by", () => {
  it("names the mode", () => {
    expect(
      [laser, cnc, plasma, printer, sublimation, tableSaw, vinyl, sewing, drill].map(machineBillingMode),
    ).toEqual([
      "hourly_job",
      "hourly_job",
      "hourly_job",
      "per_gram",
      "per_print",
      "free",
      "free",
      "free",
      "free",
    ]);
  });

  it("gives the same billing table", () => {
    expect(
      [laser, cnc, plasma, printer, sublimation, tableSaw].map((m) => billingFor({ ...m, hourlyRateCents: null })),
    ).toMatchInlineSnapshot(`
      [
        {
          "gramRateCents": 0,
          "hourlyRateCents": 1500,
          "minimumCents": 500,
          "nonmemberHourlyCents": 2500,
          "nonmemberMinimumCents": 500,
          "nonmemberSessionRateCents": 0,
          "sessionRateCents": 0,
          "sessionUnit": null,
          "setupFeeCents": 0,
        },
        {
          "gramRateCents": 0,
          "hourlyRateCents": 1000,
          "minimumCents": 1000,
          "nonmemberHourlyCents": 2000,
          "nonmemberMinimumCents": 1000,
          "nonmemberSessionRateCents": 0,
          "sessionRateCents": 0,
          "sessionUnit": null,
          "setupFeeCents": 0,
        },
        {
          "gramRateCents": 0,
          "hourlyRateCents": 1500,
          "minimumCents": 0,
          "nonmemberHourlyCents": 2500,
          "nonmemberMinimumCents": 0,
          "nonmemberSessionRateCents": 0,
          "sessionRateCents": 0,
          "sessionUnit": null,
          "setupFeeCents": 5000,
        },
        {
          "gramRateCents": 1.56,
          "hourlyRateCents": 0,
          "minimumCents": 100,
          "nonmemberHourlyCents": 0,
          "nonmemberMinimumCents": 500,
          "nonmemberSessionRateCents": 0,
          "sessionRateCents": 0,
          "sessionUnit": "gram",
          "setupFeeCents": 0,
        },
        {
          "gramRateCents": 0,
          "hourlyRateCents": 0,
          "minimumCents": 0,
          "nonmemberHourlyCents": 0,
          "nonmemberMinimumCents": 0,
          "nonmemberSessionRateCents": 200,
          "sessionRateCents": 100,
          "sessionUnit": "print",
          "setupFeeCents": 0,
        },
        {
          "gramRateCents": 0,
          "hourlyRateCents": 0,
          "minimumCents": 0,
          "nonmemberHourlyCents": 0,
          "nonmemberMinimumCents": 0,
          "nonmemberSessionRateCents": 0,
          "sessionRateCents": 0,
          "sessionUnit": null,
          "setupFeeCents": 0,
        },
      ]
    `);
  });

  it("tells the member the same thing at the desk", () => {
    expect(
      [laser, cnc, plasma, printer, sublimation, tableSaw].map((m) =>
        deskChargeHint({ ...m, hourlyRateCents: null }),
      ),
    ).toMatchInlineSnapshot(`
      [
        "Glowforge Laser is $15.00/hr members / $25.00/hr nonmembers of estimated run time (round up 5 min, $5.00 minimum). Sitting here does not start a clock.",
        "Shapeoko CNC is $10.00/hr members / $20.00/hr nonmembers of estimated run time (round up 5 min, $10.00 minimum). Sitting here does not start a clock.",
        "Langmuir CNC Plasma is $15.00/hr members / $25.00/hr nonmembers of estimated run time (round up 5 min) plus $50.00 setup (waived last weekend of the month). Sitting here does not start a clock.",
        "Bambu A1 bills by grams of filament (cost + 30%, about 1.56¢/g; $1 member / $5 nonmember min). Sitting at this PC does not charge you — you’ll see the estimate before you send the job.",
        "Sawgrass Printer is $1.00/print members, $2.00 nonmembers. Sitting here does not charge you.",
        "Table Saw is included — no machine charge. Sitting here does not charge you.",
      ]
    `);
  });

  it("ignores a rate stored on the machine row", () => {
    expect(billingFor({ ...laser, hourlyRateCents: 9999 }).hourlyRateCents).toBe(1500);
    expect(
      quoteMachineJob({
        machine: { ...laser, hourlyRateCents: 9999 } as typeof laser,
        payer: member,
        runtimeSeconds: 3600,
        at: ORDINARY,
      }).billedCents,
    ).toBe(1500);
  });
});
