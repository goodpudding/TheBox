"use client";

import type { PromoSlide } from "@/lib/data";
import { DisplayQr } from "./display-qr";

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/**
 * A slide staff wrote in Admin → Display. Its picture, if it has one, is
 * shown on the picture side by the page, not here.
 */
export function PanelPromos({ slides }: { slides: PromoSlide[] }) {
  const slide = slides[0];
  if (!slide) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <div className="h-[1vh] w-[9vw] shrink-0 rounded-full bg-display-coral" aria-hidden />
      <h1 className="mt-[2.4vh] line-clamp-3 shrink-0 text-[4.4vw] font-extrabold leading-[1.06] text-display-ink">
        {slide.title}
      </h1>
      <p className="mt-[2.2vh] line-clamp-5 shrink-0 text-[2.1vw] leading-[1.3] text-display-muted">
        {slide.body}
      </p>
      {slide.qrUrl ? (
        <div className="mt-[3vh] flex shrink-0 items-center gap-[1.4vw]">
          <DisplayQr
            url={absoluteUrl(slide.qrUrl)}
            label={slide.title}
            className="h-[9vw] w-[9vw]"
          />
          <p className="text-[1.6vw] font-bold text-display-ink">
            Scan to find out more
          </p>
        </div>
      ) : null}
    </div>
  );
}
