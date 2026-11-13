/**
 * CI check for the D1 migration chain.
 *
 * 1. Applies every migrations/*.sql, in the order Wrangler uses, to an empty
 *    SQLite database. A file that fails here would stop the production deploy
 *    halfway through `wrangler d1 migrations apply`.
 * 2. Compares the result with prisma/schema.prisma. A difference is reported
 *    as a warning, not a failure: the db-artifacts workflow commits the next
 *    migration right after a schema change is pushed.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No migrations found in migrations/");
  process.exit(1);
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "box-migrations-"));
const dbPath = path.join(tmp, "check.db");
const db = new DatabaseSync(dbPath);

let failed = false;
for (const name of files) {
  try {
    db.exec(readFileSync(path.join(dir, name), "utf8"));
    console.log(`ok   ${name}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
    break;
  }
}
db.close();

if (failed) {
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

const diff = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    `file:${dbPath}`,
    "--to-schema-datamodel",
    path.join(root, "prisma", "schema.prisma"),
    "--exit-code",
  ],
  { cwd: root, encoding: "utf8" },
);
rmSync(tmp, { recursive: true, force: true });

if (diff.status === 0) {
  console.log(`\n${files.length} migrations apply cleanly and match prisma/schema.prisma.`);
} else if (diff.status === 2) {
  const message =
    "prisma/schema.prisma has changes with no migration yet. The db-artifacts workflow writes it after the schema is pushed.";
  console.log(`\n::warning::${message}`);
  console.log(diff.stdout);
} else {
  console.error(diff.stdout, diff.stderr);
  process.exit(diff.status ?? 1);
}
