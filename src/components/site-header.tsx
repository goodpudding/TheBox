"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { useData } from "@/components/providers";
import { cn } from "@/lib/utils";

const publicLinks = [
  { href: "/join", label: "Join" },
  { href: "/events", label: "Events" },
  { href: "/equipment", label: "Equipment" },
  { href: "/support", label: "Support" },
  { href: "/policies", label: "Policies" },
  { href: "/volunteer", label: "Volunteer" },
];

const guestLinks = [...publicLinks, { href: "/login", label: "Sign in" }];

const memberLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/classes", label: "Classes" },
  { href: "/reserve", label: "Reserve" },
  { href: "/learn", label: "Learn" },
  { href: "/certifications", label: "Certifications" },
  { href: "/usage", label: "Usage" },
  { href: "/account", label: "Account" },
];

const staffLinks = [{ href: "/admin/members", label: "Admin" }];

const navClass = (active: boolean, mobile = false) =>
  cn(
    "font-display font-medium transition-colors",
    mobile
      ? "block rounded-xl px-3 py-3 text-base"
      : "rounded-full px-3 py-2 text-sm",
    active
      ? "text-primary-text bg-primary/10"
      : mobile
        ? "text-charcoal"
        : "text-secondary hover:text-brown",
  );

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, switchUser, provider, revision } = useData();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [canMaintenance, setCanMaintenance] = useState(false);

  const isStaff =
    currentUser?.role === "staff" || currentUser?.role === "admin";

  useEffect(() => {
    if (!currentUser) {
      setCanMaintenance(false);
      return;
    }
    let cancelled = false;
    void provider.getToolChampionProgress(currentUser.id).then((p) => {
      if (!cancelled) setCanMaintenance(p.canScheduleMaintenance);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, provider, revision]);

  const memberNav = [
    ...memberLinks.slice(0, 3),
    ...(canMaintenance ? [{ href: "/maintenance", label: "Maintenance" }] : []),
    ...memberLinks.slice(3),
  ];

  const links = currentUser
    ? [
        ...memberNav,
        ...publicLinks.filter((l) => l.href !== "/join"),
        ...(isStaff ? staffLinks : []),
      ]
    : guestLinks;

  async function onSignOut() {
    setSigningOut(true);
    try {
      await switchUser(null);
      await signOut({ redirect: false });
      setOpen(false);
      router.push("/join");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <BrandMark
          href={currentUser ? "/dashboard" : "/join"}
          compact
          className="min-w-0"
        />

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navClass(
                pathname === link.href || pathname.startsWith(link.href + "/"),
              )}
            >
              {link.label}
            </Link>
          ))}
          {currentUser ? (
            <button
              type="button"
              onClick={() => void onSignOut()}
              disabled={signingOut}
              className={navClass(false)}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : null}
        </nav>

        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-brown"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <nav className="md:hidden border-t border-border bg-surface px-4 py-3 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={navClass(pathname === link.href, true)}
            >
              {link.label}
            </Link>
          ))}
          {currentUser ? (
            <button
              type="button"
              onClick={() => void onSignOut()}
              disabled={signingOut}
              className={cn(navClass(false, true), "w-full text-left")}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
