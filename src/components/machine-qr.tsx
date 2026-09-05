"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

type MachineQrProps = {
  url: string;
  label: string;
};

export function MachineQr({ url, label }: MachineQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await QRCode.toDataURL(url, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) {
          setDataUrl(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not generate QR");
          setDataUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  function downloadPng() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slugify(label)}-qr.png`;
    a.click();
  }

  if (error) {
    return (
      <p className="text-sm text-brown" role="alert">
        {error}
      </p>
    );
  }

  if (!dataUrl) {
    return <p className="text-sm text-secondary">Generating QR…</p>;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code for ${label}`}
        width={280}
        height={280}
        className="rounded-lg border border-border bg-white p-2"
      />
      <Button type="button" size="sm" variant="secondary" onClick={downloadPng}>
        Download PNG
      </Button>
    </div>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "equipment"
  );
}
