import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { loadFixtures } from "./data/load-fixtures";
import { formatTier } from "./utils";

/**
 * The makerspace dropped the name "The Box". It is Discover Burien
 * Makerspace, or "the makerspace" in a sentence. The waiver is the one
 * exception: it is a signed document, so its wording only changes when staff
 * publish a new version for members to sign.
 */
describe("the name The Box is gone", () => {
  it("from the tier label", () => {
    expect(formatTier("friend")).toBe("Friend of the Makerspace");
  });

  it("from the sample content the site ships with, except the waiver", () => {
    const bundle = loadFixtures();
    const withoutWaiver = {
      ...bundle,
      contentPages: bundle.contentPages.filter((p) => p.category !== "waiver"),
    };
    const hits = [...JSON.stringify(withoutWaiver).matchAll(/.{0,40}the box.{0,20}/gi)].map(
      (m) => m[0],
    );
    expect(hits).toEqual([]);
  });

  it("the sample content still reads as sentences", () => {
    const text = JSON.stringify(loadFixtures());
    // What a careless find-and-replace leaves behind.
    expect(text).not.toMatch(/makerspace makerspace/i);
    expect(text).not.toMatch(/Makerspace · Discover Burien Makerspace/);
    expect(text).not.toMatch(/[.!?] the makerspace/);
    expect(text).not.toMatch(/<(p|li|h\d)>the makerspace/);
  });
});

describe("the migration that renames live content", () => {
  function migrated(insert: (db: DatabaseSync) => void): DatabaseSync {
    const dir = path.join(process.cwd(), "migrations");
    const db = new DatabaseSync(":memory:");
    const files = [
      "0001_init.sql",
      "0002_schema_202610260527.sql",
      "0003_schema_202610261937.sql",
      "0004_billing_url_and_admin.sql",
      "0004_datetime_text.sql",
      "0005_schema_202610262234.sql",
      "0010_membership_order.sql",
      "0011_display_photos.sql",
    ];
    for (const name of files) db.exec(readFileSync(path.join(dir, name), "utf8"));
    // Rows here are inserted alone, without the rows they would point at.
    db.exec("PRAGMA foreign_keys = OFF");
    insert(db);
    db.exec(readFileSync(path.join(dir, "0015_drop_the_box_name.sql"), "utf8"));
    return db;
  }

  /**
   * Insert a row giving only the columns the test is about. Every other
   * required column gets a filler value of the right type.
   */
  function insertRow(db: DatabaseSync, table: string, values: Record<string, string | number>) {
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const row: Record<string, string | number> = { ...values };
    for (const column of columns) {
      if (column.name in row || !column.notnull || column.dflt_value !== null) continue;
      row[column.name] = /INT|REAL|BOOL/i.test(column.type)
        ? 0
        : /DATE/i.test(column.type)
          ? "2026-01-01T00:00:00.000Z"
          : `x-${column.name}-${String(values.id ?? "")}`;
    }
    const names = Object.keys(row);
    db.prepare(
      `INSERT OR REPLACE INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
    ).run(...names.map((n) => row[n]!));
  }

  const page = (
    db: DatabaseSync,
    id: string,
    category: string,
    title: string,
    html: string,
  ) => insertRow(db, "ContentPage", { id, slug: id, title, html, category });

  it("rewrites pages in sentences that still read correctly", () => {
    const db = migrated((d) => {
      page(
        d,
        "about",
        "about",
        "How The Box got here",
        "<p>The Box started in 2024. Members love The Box. The Box is open.</p><h2>The Box’s tools</h2><p>Use of The Box makerspace is at your own risk.</p>",
      );
    });
    const row = db
      .prepare(`SELECT "title", "html" FROM "ContentPage" WHERE "id" = 'about'`)
      .get() as { title: string; html: string };
    expect(row.title).toBe("How the makerspace got here");
    expect(row.html).toBe(
      "<p>The makerspace started in 2024. Members love the makerspace. The makerspace is open.</p><h2>The makerspace’s tools</h2><p>Use of the makerspace is at your own risk.</p>",
    );
  });

  it("leaves the waiver exactly as members signed it", () => {
    const db = migrated((d) => {
      page(d, "waiver", "waiver", "Waiver", "<p>Use of The Box makerspace involves risk.</p>");
    });
    const row = db
      .prepare(`SELECT "html" FROM "ContentPage" WHERE "id" = 'waiver'`)
      .get() as { html: string };
    expect(row.html).toBe("<p>Use of The Box makerspace involves risk.</p>");
  });

  it("renames the organisation, the Friend tier and the default class location", () => {
    const db = migrated((d) => {
      insertRow(d, "OrgSettings", {
        id: "default",
        orgName: "The Box · Discover Burien Makerspace",
      });
      insertRow(d, "MembershipProduct", {
        id: "p1",
        name: "Friend of The Box",
        summary: "For supporters of The Box.",
      });
      insertRow(d, "ClassSession", { id: "c1", title: "Dovetails", location: "The Box" });
      insertRow(d, "ClassSession", {
        id: "c2",
        title: "Printing",
        location: "The Box — 3D Corner",
      });
    });
    expect(
      (db.prepare(`SELECT "orgName" FROM "OrgSettings"`).get() as { orgName: string }).orgName,
    ).toBe("Discover Burien Makerspace");
    expect(db.prepare(`SELECT "name", "summary" FROM "MembershipProduct"`).get()).toMatchObject({
      name: "Friend of the Makerspace",
      summary: "For supporters of the makerspace.",
    });
    expect(
      db.prepare(`SELECT "location" FROM "ClassSession" ORDER BY "id"`).all(),
    ).toEqual([
      { location: "Discover Burien Makerspace" },
      { location: "Discover Burien Makerspace — 3D Corner" },
    ]);
  });

  it("keeps an organisation name staff chose themselves", () => {
    const db = migrated((d) => {
      insertRow(d, "OrgSettings", { id: "default", orgName: "Burien Makers" });
    });
    expect(
      (db.prepare(`SELECT "orgName" FROM "OrgSettings"`).get() as { orgName: string }).orgName,
    ).toBe("Burien Makers");
  });
});
