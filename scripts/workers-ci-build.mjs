/**
 * Workers Builds PR jobs default to `npx wrangler preview` after npm ci.
 * That needs `.open-next/worker.js`. The dashboard build command is optional and
 * is not in this repo, so when WORKERS_CI=1, generate Prisma and run OpenNext
 * during postinstall. No-op on local installs.
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
