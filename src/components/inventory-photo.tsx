"use client";

import { cn } from "@/lib/utils";

export function inventoryPhotoSrc(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  return `/api/inventory/photos/${encodeURIComponent(storageKey)}`;
}

export function InventoryPhoto({
  storageKey,
  alt,
  className,
}: {
  storageKey?: string | null;
  alt: string;
  className?: string;
}) {
  const src = inventoryPhotoSrc(storageKey);
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-brown/10 text-xs font-display text-secondary",
          className,
        )}
      >
        No photo
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("object-cover", className)} />
  );
}
