import { describe, expect, it } from "vitest";
import { DEFAULT_RATE_CARD } from "./rate-card";
import { rateCardExamples } from "./rate-card-examples";

describe("rateCardExamples", () => {
  it("states today's prices for the default card", () => {
    expect(rateCardExamples(DEFAULT_RATE_CARD)).toEqual([
      "A 40-minute laser job costs a member $10.00 and a non-member $16.67.",
      "A 7-minute laser job is billed as 10 minutes and costs a member $5.00.",
      "A 1-hour CNC job costs a member $10.00 and a non-member $20.00.",
      "A 30-minute plasma job costs a member $57.50 with the setup fee.",
      "A 100 g print costs a member $1.56 and a non-member $5.00.",
      "Three sublimation prints cost a member $3.00 and a non-member $6.00.",
    ]);
  });

  it("follows the card", () => {
    const lines = rateCardExamples({
      ...DEFAULT_RATE_CARD,
      laserMemberHourlyCents: 1800,
      roundUpMinutes: 15,
    });
    expect(lines[0]).toBe("A 40-minute laser job costs a member $13.50 and a non-member $18.75.");
    expect(lines[1]).toBe("A 7-minute laser job is billed as 15 minutes and costs a member $5.00.");
  });
});
