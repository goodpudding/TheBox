// OpenNext adapter config for Cloudflare Workers.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * Pages the build has already rendered (login, join, the home page: every
 * route `next build` lists as static) are stored with the site's static files
 * and handed out as they are. Without a cache here the Worker rendered each
 * of them again for every visitor: about five times the work per page view,
 * on a Worker that was already running into Cloudflare's "exceeded resource
 * limits" (error 1102, shown to visitors as a 503).
 *
 * `opennextjs-cloudflare deploy` copies the pages into place (see
 * scripts/cf-deploy.sh). A build that skips that step still works: a page
 * that is not in the cache is rendered on request, as before.
 *
 * This cache is read-only: nothing on the site revalidates a page. A page
 * that needs `revalidate` needs an R2 cache instead:
 * https://opennext.js.org/cloudflare/caching
 *
 * Cache interception (answering before the Next.js server loads) is left
 * off: it adds `stale-while-revalidate` to every page, which lets a browser
 * show a page from before the last deploy.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
