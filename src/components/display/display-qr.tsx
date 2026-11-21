"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type DisplayQrProps = {
  url: string;
  label?: string;
  /** Size on screen, as Tailwind classes. The bitmap is scaled to fit. */
  className?: string;
};

/** Bitmap width. Scaled with sharp edges, so it does not need to be large. */
const QR_PIXELS = 320;

export function DisplayQr({
  url,
  label,
  className = "h-[11vh] w-[11vh]",
}: DisplayQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: QR_PIXELS,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#3a2408", light: "#ffffff" },
    }).then((next) => {
      if (!cancelled) setDataUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) {
    return (
      <div
        className={`shrink-0 rounded-[0.6vw] bg-white/40 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={label ?? "QR code"}
      className={`display-qr shrink-0 rounded-[0.6vw] bg-white p-[0.3vw] ${className}`}
    />
  );
}
