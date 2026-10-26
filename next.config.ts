import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Local `next dev` only — skip during Vercel `next build`.
if (process.env.NODE_ENV !== "production") {
  initOpenNextCloudflareForDev();
}
