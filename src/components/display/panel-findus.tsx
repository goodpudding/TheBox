"use client";

import { SlideHeading, SlideRows } from "./display-parts";

/**
 * How to reach the door. The makerspace is in the lower level at the back of
 * the Discover Burien building, so someone standing on SW 152nd St cannot see
 * it. The map on the picture side draws the same three steps.
 */
const STEPS = [
  {
    tone: "bg-display-coral",
    title: "Walk east along SW 152nd St",
    detail: "Past KW Korean BBQ and Computer Sonics",
  },
  {
    tone: "bg-display-teal",
    title: "Turn right at 6th Ave SW",
    detail: "Go round the end of the building into the lot",
  },
  {
    tone: "bg-display-gold",
    title: "Come along the back",
    detail: "We're at the rear of Discover Burien, lower level",
  },
] as const;

export function PanelFindUs() {
  return (
    <>
      <SlideHeading
        lead="Find us"
        accent="around back"
        sub="Our door is behind the Discover Burien building"
      />
      <SlideRows rows={STEPS.length} className="mt-[1.6vh]">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex min-h-0 items-center gap-[1.4vw] overflow-hidden border-b-2 border-display-rule last:border-b-0"
          >
            <span
              className={`flex h-[4.6vw] w-[4.6vw] shrink-0 items-center justify-center rounded-full text-[2.4vw] font-extrabold text-white ${step.tone}`}
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[2.3vw] font-bold leading-[1.15] text-display-ink">
                {step.title}
              </p>
              <p className="mt-[0.3vh] truncate text-[1.45vw] text-display-muted">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </SlideRows>
      <div className="mt-[1.6vh] flex shrink-0 items-center justify-between gap-[2vw] rounded-[1.4vw] bg-display-ink px-[1.6vw] py-[1.8vh] text-white">
        <div className="min-w-0">
          <p className="text-[1.3vw] font-bold uppercase tracking-[0.16em] text-[#fbc84b]">
            Address
          </p>
          <p className="truncate text-[2vw] font-bold">611 SW 152nd St, Burien</p>
        </div>
        <p className="shrink-0 text-[2vw] font-bold text-[#fbc84b]">Lower level</p>
      </div>
    </>
  );
}
