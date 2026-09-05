import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/join",
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 items-center gap-3 no-underline",
        className,
      )}
    >
      <Image
        src="/brand/discover-burien-logo.png"
        alt="Discover Burien"
        width={compact ? 72 : 96}
        height={compact ? 48 : 64}
        className={cn(
          "shrink-0 object-contain",
          compact ? "h-10 w-auto" : "h-12 w-auto sm:h-14",
        )}
        priority
      />
      <span
        className={cn(
          "min-w-0 block font-display font-semibold tracking-tight text-brown truncate",
          compact ? "text-lg" : "text-lg sm:text-xl",
        )}
      >
        The Box
      </span>
    </Link>
  );
}

export function MakerspaceBanner({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/the-box-banner.webp"
      alt="Discover Burien Makerspace — Imagine. Design. Create."
      width={1200}
      height={600}
      priority={priority}
      className={cn("h-auto w-full max-w-xl object-contain", className)}
    />
  );
}
