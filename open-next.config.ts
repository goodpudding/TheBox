// OpenNext adapter config for Cloudflare Workers.
// No incremental cache yet: pages are static or rendered on demand.
// To add one later, see https://opennext.js.org/cloudflare/caching (needs an R2 bucket).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
