"use client";

import { useState } from "react";
import type { DisplayFeedPhoto, DisplayMotion } from "@/lib/data";

const GEAR_PATH =
  "M88.6,44.6 L99.8,45.6 L99.8,54.4 L88.6,55.4 L84.4,68.4 L92.9,75.7 L87.7,82.8 L78.1,77.1 L67.0,85.1 L69.6,96.0 L61.2,98.7 L56.8,88.4 L43.2,88.4 L38.8,98.7 L30.4,96.0 L33.0,85.1 L21.9,77.1 L12.3,82.8 L7.1,75.7 L15.6,68.4 L11.4,55.4 L0.2,54.4 L0.2,45.6 L11.4,44.6 L15.6,31.6 L7.1,24.3 L12.3,17.2 L21.9,22.9 L33.0,14.9 L30.4,4.0 L38.8,1.3 L43.2,11.6 L56.8,11.6 L61.2,1.3 L69.6,4.0 L67.0,14.9 L78.1,22.9 L87.7,17.2 L92.9,24.3 L84.4,31.6Z M77.5,50.0 A27.5,27.5 0 1,0 22.5,50.0 A27.5,27.5 0 1,0 77.5,50.0Z";

function Gear({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d={GEAR_PATH}
        fill="none"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

/**
 * What the picture side shows when there is no photo to show: none uploaded
 * yet, or the one due would not load. Never a broken image.
 */
function BrandPanel() {
  return (
    <div
      data-testid="display-brand-panel"
      className="absolute inset-0 overflow-hidden bg-display-coral text-white"
    >
      <Gear className="absolute -right-[12vw] -top-[10vw] h-[38vw] w-[38vw] text-white/35" />
      <Gear className="absolute -left-[7vw] top-[22vh] h-[20vw] w-[20vw] text-white/25" />
      <div className="absolute inset-x-[3vw] bottom-[7vh]">
        <p className="text-[1.3vw] font-bold uppercase tracking-[0.18em] text-white/90">
          Discover Burien Makerspace
        </p>
        {/* One word to a line, without splitting the sentence into pieces. */}
        <p className="mt-[1.2vh] text-[5vw] font-extrabold leading-[1.04] [word-spacing:100vw]">
          Imagine. Design. Create.
        </p>
      </div>
    </div>
  );
}

const RETRY_FAILED_PHOTO_MS = 5 * 60_000;

type DisplayPhotoSideProps = {
  /** The rotating photo due on this slide, if there are any. */
  photo: DisplayFeedPhoto | null;
  /** The photo of the slide before, kept underneath while this one fades in. */
  previous?: DisplayFeedPhoto | null;
  /** A slide's own picture (a promo image) in place of the rotating photo. */
  overrideSrc?: string | null;
  motion: DisplayMotion;
};

export function DisplayPhotoSide({
  photo,
  previous,
  overrideSrc,
  motion,
}: DisplayPhotoSideProps) {
  // Sources that failed to load. A failed photo is left alone for a few
  // minutes, so the brand panel does not flash on every rotation, then tried
  // again: a short Wi-Fi drop should not cost the photo for the rest of the day.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const fail = (src: string) => {
    setFailed((list) => (list.includes(src) ? list : [...list, src]));
    window.setTimeout(
      () => setFailed((list) => list.filter((item) => item !== src)),
      RETRY_FAILED_PHOTO_MS,
    );
  };

  const ownPicture = overrideSrc && !failed.includes(overrideSrc);
  const src = ownPicture ? overrideSrc : photo?.url;
  const caption = ownPicture ? null : (photo?.caption ?? null);
  const usable = src && !failed.includes(src) ? src : null;
  const under =
    previous && previous.url !== usable && !failed.includes(previous.url)
      ? previous.url
      : null;

  return (
    <div data-testid="display-photo" className="absolute inset-0">
      {usable ? (
        <>
          {under ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={under}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => fail(under)}
            />
          ) : null}
          <div key={usable} className="display-photo-in absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={usable}
              alt={caption ?? ""}
              className={`h-full w-full object-cover ${
                motion === "full" ? "display-photo-zoom" : ""
              }`}
              onError={() => fail(usable)}
            />
          </div>
          {caption ? (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#3a2408]/90 via-[#3a2408]/55 to-transparent px-[2.4vw] pb-[4.5vh] pt-[16vh] text-white">
              <p className="text-[1.3vw] font-bold uppercase tracking-[0.18em] text-[#fbc84b]">
                At the makerspace
              </p>
              <p className="mt-[0.6vh] line-clamp-2 text-[2.4vw] font-bold leading-[1.12]">
                {caption}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <BrandPanel />
      )}
    </div>
  );
}
