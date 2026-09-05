"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/members", label: "Members" },
  { href: "/admin/certifications", label: "Certifications" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/learn", label: "Learn" },
  { href: "/admin/machines", label: "Machines" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/volunteers", label: "Volunteers" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/display", label: "Display" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/dev/reader", label: "Reader sim" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-10 -mx-1 flex gap-1 overflow-x-auto pb-2">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 font-display text-sm font-medium transition-colors",
              active
                ? "bg-brown text-white"
                : "text-secondary hover:bg-surface hover:text-brown",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
