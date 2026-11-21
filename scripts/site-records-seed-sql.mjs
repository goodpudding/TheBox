/**
 * Prints the INSERT statements that carry the lists the live site used to
 * read from fixture files into the SiteRecord table. Used once, to write
 * migrations/0012_site_records.sql. Kept so the rows can be explained.
 *
 *   node scripts/site-records-seed-sql.mjs
 *
 * INSERT OR IGNORE: a row staff have since edited is never overwritten.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (name) => JSON.parse(readFileSync(path.join(root, "data", "mock", name), "utf8"));
const sql = (value) => `'${String(value).replace(/'/g, "''")}'`;

const collections = {
  people: read("people.json"),
  wishlistZones: read("wishlist-zones.json"),
  wishlistItems: read("wishlist-items.json"),
  promoSlides: read("promos.json"),
};

const stamp = "2026-11-21T00:00:00.000Z";
for (const [collection, rows] of Object.entries(collections)) {
  console.log(`-- ${collection}: ${rows.length} rows`);
  for (const row of rows) {
    console.log(
      `INSERT OR IGNORE INTO "SiteRecord" ("id", "collection", "data", "createdAt", "updatedAt") VALUES (${sql(`${collection}:${row.id}`)}, ${sql(collection)}, ${sql(JSON.stringify(row))}, ${sql(stamp)}, ${sql(stamp)});`,
    );
  }
}
