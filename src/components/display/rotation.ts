/**
 * Where the lobby display is in its rotation. One value, moved on by one pure
 * step, so a slide change updates everything together. (The counters used to
 * be bumped from inside another state update, which React runs twice in
 * development: rounds were counted double there.)
 */
export type RotationState = {
  /** Every slide shown so far. Picks the photo and replays the entrance. */
  slide: number;
  /** Which panel of the current round is up. */
  panelIndex: number;
  /** Rounds completed. Pages long lists and paces the Membership panel. */
  cycle: number;
  /** Which promo is due next time the promo panel comes up. */
  promoIndex: number;
};

export const START_OF_ROTATION: RotationState = {
  slide: 0,
  panelIndex: 0,
  cycle: 0,
  promoIndex: 0,
};

/** The state after the slide on screen has had its time. */
export function advanceRotation(
  state: RotationState,
  panelCount: number,
): RotationState {
  const next = state.panelIndex + 1;
  const newRound = next >= panelCount;
  return {
    slide: state.slide + 1,
    panelIndex: newRound ? 0 : next,
    cycle: state.cycle + (newRound ? 1 : 0),
    promoIndex: state.promoIndex + (newRound ? 1 : 0),
  };
}
