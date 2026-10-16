"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useData } from "@/components/providers";
import { canInventory } from "@/lib/inventory/permissions";
import { cn } from "@/lib/utils";

export function InventorySubnav() {
  const pathname = usePathname();
  const { currentUser, provider, revision } = useData();
  const [pending, setPending] = useState(0);
  const [stewards, setStewards] = useState<
    Awaited<ReturnType<typeof provider.listAreaStewards>>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void provider.listAreaStewards().then((rows) => {
      if (!cancelled) setStewards(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  const staff = currentUser
    ? canInventory(currentUser, "printLabels", { stewards })
    : false;
  const reviewer = currentUser
    ? canInventory(currentUser, "viewPending", { stewards })
    : false;
  const volunteer = currentUser
    ? canInventory(currentUser, "submit", { stewards })
    : false;

  useEffect(() => {
    if (!currentUser || !reviewer) {
      setPending(0);
      return;
    }
    let cancelled = false;
    void provider.pendingInventoryCount(currentUser.id).then((n) => {
      if (!cancelled) setPending(n);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, provider, revision, reviewer]);

  const links = [
    { href: "/inventory", label: "Browse", show: true },
    { href: "/inventory/new", label: "Add item", show: volunteer },
    {
      href: "/inventory/review",
      label: pending > 0 ? `Review (${pending})` : "Review",
      show: reviewer,
    },
    { href: "/inventory/labels", label: "Labels", show: staff },
    { href: "/inventory/import", label: "Import", show: staff },
  ].filter((l) => l.show);

  return (
    <nav className="mb-8 -mx-1 flex gap-1 overflow-x-auto pb-2">
      {links.map((link) => {
        const active =
          link.href === "/inventory"
            ? pathname === "/inventory"
            : pathname === link.href || pathname.startsWith(link.href + "/");
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
