import type { Metadata } from "next";
import { Alice, Outfit } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { DemoBanner } from "@/components/demo-banner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DevToolbar } from "@/components/dev-toolbar";
import "./globals.css";

const alice = Alice({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-alice",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const metadata: Metadata = {
  title: {
    default: isDemo
      ? "The Box · Demo (not live)"
      : "The Box · Discover Burien Makerspace",
    template: "%s · The Box",
  },
  description:
    "Member portal for The Box, the community makerspace run by Discover Burien.",
  robots: isDemo ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${alice.variable} ${outfit.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-page text-charcoal antialiased">
        <AppProviders>
          <DemoBanner />
          <SiteHeader />
          <main className="flex-1 w-full">{children}</main>
          <SiteFooter />
          <DevToolbar />
        </AppProviders>
      </body>
    </html>
  );
}
