"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { useData } from "@/components/providers";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/data";

const publicLinks = [
  { href: "/join", label: "Join" },
  { href: "/events", label: "Events" },
  { href: "/equipment", label: "Equipment" },
  { href: "/made", label: "Made here" },
  { href: "/bounties", label: "Bounties" },
  { href: "/support", label: "Support" },
  { href: "/policies", label: "Policies" },
  { href: "/volunteer", label: "Volunteer" },
];

/**
 * Member shop tools — always tinted amber when signed in so they read as
 * “your portal,” separate from public Explore links.
 * Classes live under Events for guests; members still get a Classes shortcut here.
 */
const shopLinks = [
  { href: "/classes", label: "Classes" },
  { href: "/reserve", label: "Reserve" },
  { href: "/learn", label: "Learn" },
];

function roleLabel(role: Role, isTeacher?: boolean): string {
  const base =
    role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Member";
  return isTeacher ? `${base} · Teacher` : base;
}

function linkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function navClass(active: boolean, mobile = false) {
  return cn(
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
}

/** Amber “member shop” chip — visible even when the route is inactive. */
function memberNavClass(active: boolean, mobile = false) {
  return cn(
    "font-display font-semibold transition-colors",
    mobile
      ? "block rounded-xl px-3 py-3 text-base"
      : "rounded-full px-3 py-2 text-sm",
    active
      ? "bg-primary text-brown"
      : mobile
        ? "bg-primary/15 text-brown"
        : "bg-primary/15 text-brown hover:bg-primary/25",
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, switchUser, provider, revision } = useData();
  const [open, setOpen] = useState(false);
  const [youOpen, setYouOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [canMaintenance, setCanMaintenance] = useState(false);
  const youRef = useRef<HTMLDivElement>(null);
  const youMenuId = useId();

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

  useEffect(() => {
    setYouOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!youOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!youRef.current?.contains(e.target as Node)) setYouOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setYouOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [youOpen]);

  const exploreLinks = currentUser
    ? publicLinks.filter((l) => l.href !== "/join")
    : publicLinks;

  const youLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/usage", label: "Usage" },
    { href: "/account", label: "Account" },
    ...(canMaintenance
      ? [{ href: "/maintenance", label: "Maintenance" }]
      : []),
  ];

  const youSectionActive = youLinks.some((l) => linkActive(pathname, l.href));

  async function onSignOut() {
    setSigningOut(true);
    try {
      await switchUser(null);
      await signOut({ redirect: false });
      setYouOpen(false);
      setOpen(false);
      router.push("/join");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandMark
          href={currentUser ? "/dashboard" : "/join"}
          compact
          className="min-w-0"
        />

        <nav
          className="hidden md:flex items-center gap-1 min-w-0"
          aria-label="Primary"
        >
          {exploreLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navClass(linkActive(pathname, link.href))}
            >
              {link.label}
            </Link>
          ))}

          {currentUser ? (
            <>
              {shopLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={memberNavClass(linkActive(pathname, link.href))}
                >
                  {link.label}
                </Link>
              ))}

              {isStaff ? (
                <Link
                  href="/admin/members"
                  className={cn(
                    "font-display rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-accent/20 text-brown"
                      : "text-button hover:bg-button/10",
                  )}
                >
                  Admin
                </Link>
              ) : null}

              <div className="relative ml-1" ref={youRef}>
                <button
                  type="button"
                  aria-expanded={youOpen}
                  aria-controls={youMenuId}
                  aria-haspopup="menu"
                  onClick={() => setYouOpen((v) => !v)}
                  className={cn(
                    "font-display inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                    youOpen || youSectionActive
                      ? "bg-primary text-brown"
                      : "bg-primary/15 text-brown hover:bg-primary/25",
                  )}
                >
                  You
                  <span className="font-medium opacity-70">
                    · {currentUser.firstName}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 opacity-70 transition-transform",
                      youOpen && "rotate-180",
                    )}
                  />
                </button>

                {youOpen ? (
                  <div
                    id={youMenuId}
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
                  >
                    <div className="border-b border-border px-4 py-3">
                      <p className="font-display text-sm font-semibold text-brown">
                        {currentUser.displayName}
                      </p>
                      <p className="mt-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-primary-text">
                        {roleLabel(currentUser.role, currentUser.isTeacher)} account
                      </p>
                    </div>
                    <div className="p-1.5">
                      {youLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          onClick={() => setYouOpen(false)}
                          className={cn(
                            "block rounded-xl px-3 py-2.5 font-display text-sm font-medium transition-colors",
                            linkActive(pathname, link.href)
                              ? "bg-primary/15 text-brown"
                              : "text-charcoal hover:bg-page",
                          )}
                        >
                          {link.label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void onSignOut()}
                        disabled={signingOut}
                        className="mt-1 w-full rounded-xl px-3 py-2.5 text-left font-display text-sm font-medium text-secondary hover:bg-page hover:text-brown"
                      >
                        {signingOut ? "Signing out…" : "Sign out"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="ml-1 font-display rounded-full bg-button px-4 py-2 text-sm font-semibold text-white hover:bg-button-hover"
            >
              Sign in
            </Link>
          )}
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
        <div className="md:hidden border-t border-border bg-surface px-4 py-4 space-y-5">
          <nav className="space-y-1" aria-label="Explore">
            {exploreLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={navClass(linkActive(pathname, link.href), true)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {currentUser ? (
            <>
              <div>
                <p className="eyebrow mb-2">Shop</p>
                <nav className="space-y-1">
                  {shopLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={memberNavClass(
                        linkActive(pathname, link.href),
                        true,
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {isStaff ? (
                    <Link
                      href="/admin/members"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-xl px-3 py-3 font-display text-base font-semibold",
                        pathname.startsWith("/admin")
                          ? "bg-accent/20 text-brown"
                          : "text-button",
                      )}
                    >
                      Admin
                    </Link>
                  ) : null}
                </nav>
              </div>

              <div>
                <p className="eyebrow mb-1">You</p>
                <p className="mb-2 font-display text-xs text-secondary">
                  {currentUser.displayName} · {roleLabel(currentUser.role, currentUser.isTeacher)}{" "}
                  account
                </p>
                <nav className="space-y-1 rounded-2xl bg-primary/10 p-2">
                  {youLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-xl px-3 py-3 font-display text-base font-semibold",
                        linkActive(pathname, link.href)
                          ? "bg-primary text-brown"
                          : "text-brown",
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>

              <button
                type="button"
                onClick={() => void onSignOut()}
                disabled={signingOut}
                className="w-full rounded-xl border border-border px-3 py-3 text-left font-display text-base font-medium text-secondary"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-button px-3 py-3 text-center font-display text-base font-semibold text-white"
            >
              Sign in
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
