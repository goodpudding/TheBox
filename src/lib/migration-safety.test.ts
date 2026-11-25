import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  REVIEWED_TABLE_DROPS,
  applyMigration,
  describeUnsafeDrops,
} from "../../scripts/migration-safety.mjs";

/**
 * Prisma cannot always change a SQLite table in place. When it cannot, it
 * writes a "redefine": create new_X, copy the rows, DROP TABLE X, rename
 * new_X to X, all with foreign keys switched off.
 *
 * Cloudflare D1 runs a migration inside a transaction, and SQLite ignores
 * `PRAGMA foreign_keys` inside a transaction. So on the live database the
 * foreign keys stay on, and DROP TABLE, which deletes every row first, fires
 * ON DELETE on the tables that point at X.
 */

const migrationsDir = path.join(process.cwd(), "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/** A database with every migration in the repo applied. Foreign keys are on. */
function migrated(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const name of migrationFiles) {
    db.exec(readFileSync(path.join(migrationsDir, name), "utf8"));
  }
  db.exec("PRAGMA foreign_keys = ON");
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
    `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
  ).run(...names.map((n) => row[n]!));
}

/** One piece of equipment in an area, with a photo and a history entry. */
function withOneItem(db: DatabaseSync): DatabaseSync {
  insertRow(db, "User", { id: "u1" });
  insertRow(db, "InventoryArea", { id: "a1" });
  insertRow(db, "InventoryItem", { id: "i1", tagNumber: 42, areaId: "a1", createdById: "u1" });
  insertRow(db, "ItemPhoto", { id: "p1", itemId: "i1", uploadedById: "u1" });
  insertRow(db, "ItemEvent", { id: "e1", itemId: "i1", actorId: "u1" });
  return db;
}

const count = (db: DatabaseSync, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n;

const columnsOf = (db: DatabaseSync, table: string) =>
  (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>)
    .map((c) => `"${c.name}"`)
    .join(", ");

/** The four statements at the heart of a redefine, built from the live table. */
function rebuildStatements(db: DatabaseSync, table: string): string[] {
  const { sql } = db
    .prepare(`SELECT "sql" FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table) as { sql: string };
  expect(sql).toContain(`CREATE TABLE "${table}" (`);
  const columns = columnsOf(db, table);
  return [
    sql.replace(
      `CREATE TABLE "${table}" (`,
      `CREATE TABLE "new_${table}" (\n    "addedLater" BOOLEAN NOT NULL DEFAULT true,`,
    ) + ";",
    `INSERT INTO "new_${table}" (${columns}) SELECT ${columns} FROM "${table}";`,
    `DROP TABLE "${table}";`,
    `ALTER TABLE "new_${table}" RENAME TO "${table}";`,
  ];
}

/** What `prisma migrate diff` writes to add a column it cannot ALTER in. */
function redefine(db: DatabaseSync, table: string): string {
  return [
    "-- RedefineTables",
    "PRAGMA defer_foreign_keys=ON;",
    "PRAGMA foreign_keys=OFF;",
    ...rebuildStatements(db, table),
    "PRAGMA foreign_keys=ON;",
    "PRAGMA defer_foreign_keys=OFF;",
  ].join("\n");
}

const lineOf = (sql: string, start: string) =>
  sql.split("\n").findIndex((line) => line.startsWith(start)) + 1;

/** D1 wraps the whole migration in one transaction. */
function runAsD1(db: DatabaseSync, sql: string) {
  db.exec("BEGIN");
  db.exec(sql);
  db.exec("COMMIT");
}

describe("a table rebuild on D1", () => {
  it("deletes every photo and history entry of the equipment it rebuilds", () => {
    const db = withOneItem(migrated());

    runAsD1(db, redefine(db, "InventoryItem"));

    // The item itself is copied across, so the site looks fine at a glance.
    expect(count(db, "InventoryItem")).toBe(1);
    expect(count(db, "ItemPhoto")).toBe(0);
    expect(count(db, "ItemEvent")).toBe(0);
  });

  it("blanks a column that is ON DELETE SET NULL", () => {
    const db = withOneItem(migrated());

    runAsD1(db, redefine(db, "InventoryArea"));

    expect(count(db, "InventoryArea")).toBe(1);
    const item = db.prepare(`SELECT "areaId" FROM "InventoryItem"`).get() as {
      areaId: string | null;
    };
    expect(item.areaId).toBeNull();
  });

  it("leaves rows that are ON DELETE RESTRICT alone", () => {
    // Prisma's `PRAGMA defer_foreign_keys` does work inside a transaction.
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE "Owner" ("id" TEXT NOT NULL PRIMARY KEY);
      CREATE TABLE "Thing" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "ownerId" TEXT NOT NULL REFERENCES "Owner" ("id") ON DELETE RESTRICT
      );
      INSERT INTO "Owner" VALUES ('o1');
      INSERT INTO "Thing" VALUES ('t1', 'o1');
    `);

    runAsD1(db, redefine(db, "Owner"));

    expect(db.prepare(`SELECT * FROM "Thing"`).all()).toEqual([{ id: "t1", ownerId: "o1" }]);
    expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([]);
  });

  it("looks harmless in plain SQLite, where the migration can switch foreign keys off", () => {
    const db = withOneItem(migrated());

    db.exec(redefine(db, "InventoryItem"));

    expect(count(db, "ItemPhoto")).toBe(1);
    expect(count(db, "ItemEvent")).toBe(1);
  });

  it("is not needed to add a column: ALTER TABLE keeps the child rows", () => {
    const db = withOneItem(migrated());

    runAsD1(db, `ALTER TABLE "InventoryItem" ADD COLUMN "addedLater" BOOLEAN NOT NULL DEFAULT true;`);

    expect(count(db, "ItemPhoto")).toBe(1);
    expect(count(db, "ItemEvent")).toBe(1);
  });

  it("keeps the child rows when they are set aside first and put back after", () => {
    const db = withOneItem(migrated());
    const aside = (table: string) =>
      `CREATE TABLE "keep_${table}" AS SELECT * FROM "${table}";`;
    const back = (table: string) =>
      `INSERT INTO "${table}" (${columnsOf(db, table)}) SELECT ${columnsOf(db, table)} FROM "keep_${table}";\nDROP TABLE "keep_${table}";`;

    runAsD1(
      db,
      [
        aside("ItemPhoto"),
        aside("ItemEvent"),
        ...rebuildStatements(db, "InventoryItem"),
        back("ItemPhoto"),
        back("ItemEvent"),
      ].join("\n"),
    );

    expect(count(db, "InventoryItem")).toBe(1);
    expect(count(db, "ItemPhoto")).toBe(1);
    expect(count(db, "ItemEvent")).toBe(1);
  });
});

describe("the migration check", () => {
  it("reports a rebuild of a table that other tables point at", () => {
    const db = migrated();
    const sql = redefine(db, "InventoryItem");

    const drops = applyMigration(db, sql);

    expect(drops).toEqual([
      {
        table: "InventoryItem",
        line: lineOf(sql, "DROP TABLE"),
        references: [
          { table: "ItemEvent", column: "itemId", onDelete: "CASCADE" },
          { table: "ItemPhoto", column: "itemId", onDelete: "CASCADE" },
        ],
      },
    ]);
  });

  it("reports a reference that is ON DELETE SET NULL", () => {
    const db = migrated();

    const [area] = applyMigration(db, redefine(db, "InventoryArea"));

    expect(area!.references).toContainEqual({
      table: "InventoryItem",
      column: "areaId",
      onDelete: "SET NULL",
    });
  });

  it("does not report a reference that is ON DELETE RESTRICT", () => {
    const db = migrated();

    const [user] = applyMigration(db, redefine(db, "User"));

    const inventory = user!.references.filter((r) => r.table === "InventoryItem");
    expect(inventory).toEqual([
      { table: "InventoryItem", column: "reviewedById", onDelete: "SET NULL" },
    ]);
  });

  it("applies the migration it is checking", () => {
    const db = migrated();

    applyMigration(db, `ALTER TABLE "InventoryItem" ADD COLUMN "addedLater" BOOLEAN;`);

    expect(columnsOf(db, "InventoryItem")).toContain('"addedLater"');
  });

  it("passes a column added with ALTER TABLE", () => {
    const db = migrated();

    expect(
      applyMigration(
        db,
        `ALTER TABLE "InventoryItem" ADD COLUMN "addedLater" BOOLEAN NOT NULL DEFAULT true;`,
      ),
    ).toEqual([]);
  });

  it("passes a rebuild of a table nothing points at", () => {
    const db = migrated();

    expect(applyMigration(db, redefine(db, "ItemPhoto"))).toEqual([]);
  });

  it("passes a table removed after the tables that pointed at it", () => {
    const db = migrated();

    expect(
      applyMigration(
        db,
        `DROP TABLE "ItemPhoto";\nDROP TABLE "ItemEvent";\nDROP TABLE "InventoryItem";`,
      ),
    ).toEqual([]);
  });

  it("reports a table removed before the tables that point at it", () => {
    const db = migrated();

    const drops = applyMigration(
      db,
      `DROP TABLE IF EXISTS "main"."InventoryItem";\nDROP TABLE "ItemPhoto";\nDROP TABLE "ItemEvent";`,
    );

    expect(drops.map((d) => [d.table, d.line])).toEqual([["InventoryItem", 1]]);
  });

  it("finds the table whatever the spelling", () => {
    for (const statement of [
      "drop table InventoryItem;",
      "DROP  TABLE\n  `inventoryitem`;",
      "DROP TABLE [InventoryItem];",
    ]) {
      const drops = applyMigration(migrated(), statement);
      expect(drops.map((d) => d.table)).toEqual(["InventoryItem"]);
    }
  });

  it("is not fooled by DROP TABLE in a comment or in a string", () => {
    const db = migrated();

    expect(
      applyMigration(
        db,
        [
          `-- DROP TABLE "InventoryItem"; would delete the photos`,
          `/* so would this:`,
          `   DROP TABLE "InventoryItem"; */`,
          `UPDATE "ContentPage" SET "html" = 'it''s; DROP TABLE "InventoryItem"; -- still text';`,
        ].join("\n"),
      ),
    ).toEqual([]);
    expect(count(db, "InventoryItem")).toBe(0);
  });

  it("says what would be lost, why, and what to write instead", () => {
    const db = migrated();
    const sql = redefine(db, "InventoryItem");
    const drops = applyMigration(db, sql);

    const message = describeUnsafeDrops("0099_schema_202611250101.sql", drops);

    expect(message).toContain("migrations/0099_schema_202611250101.sql");
    expect(message).toContain(`line ${lineOf(sql, "DROP TABLE")}: DROP TABLE "InventoryItem"`);
    expect(message).toMatch(/ItemPhoto\.itemId.*ON DELETE CASCADE.*deleted/);
    expect(message).toMatch(/ItemEvent\.itemId.*ON DELETE CASCADE.*deleted/);
    expect(message).toContain("Cloudflare D1");
    expect(message).toContain("ALTER TABLE");
    expect(message).toContain("ADD COLUMN");
    expect(message).toContain("by hand");
    expect(message).toContain("REVIEWED_TABLE_DROPS");
  });

  it("allows the migrations already on the live database, and only those", () => {
    const db = new DatabaseSync(":memory:");
    const flagged: string[] = [];
    for (const name of migrationFiles) {
      const drops = applyMigration(db, readFileSync(path.join(migrationsDir, name), "utf8"));
      if (drops.length > 0) flagged.push(name);
    }

    expect(flagged).toEqual([...REVIEWED_TABLE_DROPS].sort());
  });
});
