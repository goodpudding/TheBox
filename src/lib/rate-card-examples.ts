import { dollars, quoteMachineJob } from "@/lib/credits";
import type { RateCard } from "@/lib/rate-card";

const member = { tier: "maker" as const, shopAccess: true, status: "active" };
const guest = { tier: "day" as const, shopAccess: true, status: "active" };

/** A weekday in the middle of a month: never a plasma waiver day. */
const ORDINARY_DAY = new Date(2026, 9, 14);

const laser = { id: "example-laser", name: "Laser", area: "laser" as const };
const cnc = { id: "example-cnc", name: "CNC", area: "woodshop" as const };
const plasma = { id: "example-plasma", name: "Plasma", area: "cnc_plasma" as const };
const printer = { id: "example-printer", name: "Printer", area: "3d_printing" as const };
const sublimation = { id: "example-sub", name: "Sublimation", area: "sublimation" as const };

/**
 * What a few ordinary jobs cost on a card, in sentences. Worked out with the
 * same function that prices a real job, so the form under Admin → Settings
 * shows staff what a change will do before they save it.
 */
export function rateCardExamples(rates: RateCard): string[] {
  const run = (machine: typeof laser | typeof cnc | typeof plasma, minutes: number, payer: typeof member | typeof guest) =>
    dollars(
      quoteMachineJob({ machine, payer, runtimeSeconds: minutes * 60, at: ORDINARY_DAY, rates })
        .billedCents,
    );
  const print = (grams: number, payer: typeof member | typeof guest) =>
    dollars(quoteMachineJob({ machine: printer, payer, filamentGrams: grams, rates }).billedCents);
  const sheets = (prints: number, payer: typeof member | typeof guest) =>
    dollars(quoteMachineJob({ machine: sublimation, payer, prints, rates }).billedCents);

  return [
    `A 40-minute laser job costs a member ${run(laser, 40, member)} and a non-member ${run(laser, 40, guest)}.`,
    `A 7-minute laser job is billed as ${Math.ceil(7 / rates.roundUpMinutes) * rates.roundUpMinutes} minutes and costs a member ${run(laser, 7, member)}.`,
    `A 1-hour CNC job costs a member ${run(cnc, 60, member)} and a non-member ${run(cnc, 60, guest)}.`,
    `A 30-minute plasma job costs a member ${run(plasma, 30, member)} with the setup fee.`,
    `A 100 g print costs a member ${print(100, member)} and a non-member ${print(100, guest)}.`,
    `Three sublimation prints cost a member ${sheets(3, member)} and a non-member ${sheets(3, guest)}.`,
  ];
}
