import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Local `next dev` only. Workers Builds and Vercel run `next build` with
// NODE_ENV=production — do not spin up a Miniflare proxy there.
if (process.env.NODE_ENV !== "production") {
  initOpenNextCloudflareForDev();
}
