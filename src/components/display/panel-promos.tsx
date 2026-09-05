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

export function PanelPromos({ slides }: { slides: PromoSlide[] }) {
  const slide = slides[0];
  if (!slide) return null;

  return (
    <div className="flex h-full flex-col justify-center gap-[2.5vh]">
      {slide.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.imageUrl}
          alt=""
          className="max-h-[42vh] w-full object-cover"
        />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-[2vw]">
        <div className="max-w-[70%]">
          <h1 className="font-display text-[clamp(2rem,4vw,4rem)] font-semibold leading-tight text-brown">
            {slide.title}
          </h1>
          <p className="mt-[1.5vh] font-display text-[clamp(1.15rem,2.1vw,1.9rem)] leading-snug text-secondary">
            {slide.body}
          </p>
        </div>
        {slide.qrUrl ? (
          <DisplayQr
            url={absoluteUrl(slide.qrUrl)}
            size={150}
            label={slide.title}
          />
        ) : null}
      </div>
    </div>
  );
}
