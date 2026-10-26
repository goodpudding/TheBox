"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DevToolbar } from "@/components/dev-toolbar";
import { isWorkstationKioskPath } from "@/lib/workstation/chrome";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const kiosk = isWorkstationKioskPath(pathname);
  if (kiosk) {
    return <main className="flex-1 w-full min-h-full">{children}</main>;
  }
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main className="flex-1 w-full">{children}</main>
      <SiteFooter />
      <DevToolbar />
    </>
  );
}
