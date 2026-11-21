import { describe, expect, it } from "vitest";
import { START_OF_ROTATION, advanceRotation } from "./rotation";

describe("advanceRotation", () => {
  it("moves to the next panel and counts the slide", () => {
    expect(advanceRotation(START_OF_ROTATION, 3)).toEqual({
      slide: 1,
      panelIndex: 1,
      cycle: 0,
      promoIndex: 0,
    });
  });

  it("starts the next round after the last panel", () => {
    const last = { slide: 2, panelIndex: 2, cycle: 0, promoIndex: 0 };
    expect(advanceRotation(last, 3)).toEqual({
      slide: 3,
      panelIndex: 0,
      cycle: 1,
      promoIndex: 1,
    });
  });

  it("counts a round every time when only one panel is showing", () => {
    let state = START_OF_ROTATION;
    for (let i = 0; i < 4; i++) state = advanceRotation(state, 1);
    expect(state).toEqual({ slide: 4, panelIndex: 0, cycle: 4, promoIndex: 4 });
  });

  it("goes back to the first panel when the rotation got shorter", () => {
    const past = { slide: 9, panelIndex: 5, cycle: 1, promoIndex: 1 };
    expect(advanceRotation(past, 2).panelIndex).toBe(0);
  });

  it("gives the same answer however often it is asked", () => {
    const state = { slide: 4, panelIndex: 1, cycle: 2, promoIndex: 2 };
    expect(advanceRotation(state, 2)).toEqual(advanceRotation(state, 2));
    expect(state).toEqual({ slide: 4, panelIndex: 1, cycle: 2, promoIndex: 2 });
  });
});
