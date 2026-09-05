"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type DisplayQrProps = {
  url: string;
  size?: number;
  label?: string;
};

export function DisplayQr({ url, size = 160, label }: DisplayQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#3d2b1f", light: "#ffffff" },
    }).then((next) => {
      if (!cancelled) setDataUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-lg bg-white/20"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={label ?? "QR code"}
      width={size}
      height={size}
      className="rounded-lg bg-white p-1"
    />
  );
}
