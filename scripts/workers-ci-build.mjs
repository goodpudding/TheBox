/**
 * Workers Builds PR jobs default to `npx wrangler preview` after npm ci.
 * That needs `.open-next/worker.js`. The dashboard build command is optional and
 * is not in this repo, so when WORKERS_CI=1, generate Prisma, run OpenNext
 * and fill its page cache during postinstall. No-op on local installs.
 */
import { spawnSync } from "node:child_process";

if (process.env.WORKERS_CI !== "1") {
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["opennextjs-cloudflare", "build"]);

// The page cache (open-next.config.ts) is kept with the static files, and
// only `opennextjs-cloudflare deploy` puts it there. This path uploads the
// build as it is, so copy it here. Not fatal: without it the preview renders
// each page on request, which is slower but correct.
const cache = spawnSync("npx", ["opennextjs-cloudflare", "populateCache", "local"], {
  stdio: "inherit",
});
if (cache.status !== 0) {
  console.warn("Page cache was not populated; the preview will render pages on request.");
}
