/**
 * Prints the INSERT statements that carry the lists the live site used to
 * read from fixture files into the SiteRecord table. Used to write
 * migrations/0019_site_records.sql and 0020_gallery_projects.sql. Kept so
 * the rows can be explained.
 *
 *   node scripts/site-records-seed-sql.mjs [collection ...]
 *
 * INSERT OR IGNORE: a row staff have since edited is never overwritten.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (name) => JSON.parse(readFileSync(path.join(root, "data", "mock", name), "utf8"));
const sql = (value) => `'${String(value).replace(/'/g, "''")}'`;

const all = {
  people: read("people.json"),
  wishlistZones: read("wishlist-zones.json"),
  wishlistItems: read("wishlist-items.json"),
  projects: read("projects.json"),
};
// Name the collections to print, or none for all of them.
const wanted = process.argv.slice(2);
const collections = Object.fromEntries(
  Object.entries(all).filter(([name]) => wanted.length === 0 || wanted.includes(name)),
);

const stamp = "2026-11-21T00:00:00.000Z";
for (const [collection, rows] of Object.entries(collections)) {
  console.log(`-- ${collection}: ${rows.length} rows`);
  for (const row of rows) {
    console.log(
      `INSERT OR IGNORE INTO "SiteRecord" ("id", "collection", "data", "createdAt", "updatedAt") VALUES (${sql(`${collection}:${row.id}`)}, ${sql(collection)}, ${sql(JSON.stringify(row))}, ${sql(stamp)}, ${sql(stamp)});`,
    );
  }
}
