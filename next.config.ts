import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Required for Prisma on Cloudflare Workers: lets OpenNext replace the
  // generated client with its workerd (WASM) runtime instead of bundling the
  // Node build, which would look for a native query-engine binary.
  // https://opennext.js.org/cloudflare/howtos/db
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;

// Local `next dev` only. Workers Builds and Vercel run `next build` with
// NODE_ENV=production — do not spin up a Miniflare proxy there.
if (process.env.NODE_ENV !== "production") {
  initOpenNextCloudflareForDev();
}
