import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wishlist",
  description:
    "Item-by-item asks for the makerspace — buy the exact tool we picked, or tell staff first so two people don’t get the same saw.",
};

export default function WishlistLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
