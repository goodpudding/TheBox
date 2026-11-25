/**
 * Finds migrations that would lose rows on the live database.
 *
 * The live database is Cloudflare D1. D1 runs a migration inside a
 * transaction, and SQLite ignores `PRAGMA foreign_keys=OFF` inside a
 * transaction, so foreign keys stay on whatever the file says. DROP TABLE
 * deletes every row of the table before it removes it, and that fires
 * ON DELETE in the tables that point at it:
 *
 *   ON DELETE CASCADE      their rows are deleted
 *   ON DELETE SET NULL     their column is blanked
 *   ON DELETE SET DEFAULT  their column is reset
 *
 * This happens even when the migration copies the table into "new_X" first
 * and renames it back, which is what `prisma migrate diff` writes when it
 * cannot ALTER a table in place. A scratch SQLite database does not show it,
 * because there the PRAGMA works.
 *
 * ON DELETE RESTRICT and NO ACTION are left alone: Prisma's rebuild defers
 * those checks and the rows still match once the table is renamed back.
 *
 * src/lib/migration-safety.test.ts proves each of these statements.
 */

/**
 * Migrations that drop a referenced table and are allowed to. Add a file here
 * only after checking by hand that it keeps the rows of the tables it names.
 */
export const REVIEWED_TABLE_DROPS = new Set([
  // Rebuilt "User". It ran on the live database before this check existed.
  "0003_schema_202610261937.sql",
]);

const IDENTIFIER = String.raw`(?:"[^"]*"|\`[^\`]*\`|\[[^\]]*\]|[A-Za-z_][\w$]*)`;
const DROP_TABLE = new RegExp(
  String.raw`\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:${IDENTIFIER}\s*\.\s*)?(${IDENTIFIER})`,
  "gi",
);

/**
 * The same SQL with comments and string literals replaced by spaces, so a
 * search for a statement cannot match inside them. Offsets and line numbers
 * are unchanged. Quoted identifiers are kept.
 */
function withoutTextAndComments(sql) {
  return sql.replace(
    /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'[^']*'?|"[^"]*"?|`[^`]*`?|\[[^\]]*\]?/g,
    (match) => (/^["`[]/.test(match) ? match : match.replace(/[^\n]/g, " ")),
  );
}

const unquote = (identifier) =>
  /^["`[]/.test(identifier) ? identifier.slice(1, -1) : identifier;

/** Columns in other tables whose rows change when `table` loses its rows. */
function referencesThatChangeRows(db, table) {
  return db
    .prepare(
      `SELECT m.name AS "table", f."from" AS "column", f.on_delete AS "onDelete"
         FROM sqlite_master m, pragma_foreign_key_list(m.name) f
        WHERE m.type = 'table'
          AND m.name <> ?1 COLLATE NOCASE
          AND f."table" = ?1 COLLATE NOCASE
          AND f.on_delete IN ('CASCADE', 'SET NULL', 'SET DEFAULT')
        ORDER BY m.name, f."from"`,
    )
    .all(table)
    .map((row) => ({ ...row }));
}

/**
 * Apply one migration to `db`, and return each DROP TABLE in it that would
 * change rows in other tables on D1. The tables are looked up at the moment
 * of the drop, so a child table dropped earlier in the same file is not
 * counted.
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} sql
 * @returns {Array<{ table: string, line: number, references: Array<{ table: string, column: string, onDelete: string }> }>}
 */
export function applyMigration(db, sql) {
  const unsafe = [];
  let applied = 0;
  for (const match of withoutTextAndComments(sql).matchAll(DROP_TABLE)) {
    db.exec(sql.slice(applied, match.index));
    applied = match.index;
    const existing = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? COLLATE NOCASE`)
      .get(unquote(match[1]));
    if (!existing) continue;
    const references = referencesThatChangeRows(db, existing.name);
    if (references.length > 0) {
      unsafe.push({
        table: existing.name,
        line: sql.slice(0, match.index).split("\n").length,
        references,
      });
    }
  }
  db.exec(sql.slice(applied));
  return unsafe;
}

function consequence(parent, { table, column, onDelete }) {
  const what =
    onDelete === "CASCADE"
      ? `every ${table} row that points at "${parent}" is deleted`
      : onDelete === "SET NULL"
        ? `"${column}" is blanked on every ${table} row that points at "${parent}"`
        : `"${column}" is reset to its default on every ${table} row that points at "${parent}"`;
  return `${table}.${column} is ON DELETE ${onDelete}: ${what}`;
}

/**
 * The failure message for one migration file.
 *
 * @param {string} file name of the file in migrations/
 * @param {ReturnType<typeof applyMigration>} drops
 */
export function describeUnsafeDrops(file, drops) {
  const lines = [`migrations/${file} would lose data on the live database (Cloudflare D1).`, ""];
  for (const drop of drops) {
    lines.push(`  line ${drop.line}: DROP TABLE "${drop.table}"`);
    for (const reference of drop.references) {
      lines.push(`    ${consequence(drop.table, reference)}`);
    }
  }
  const example = drops[0]?.table ?? "X";
  lines.push(
    "",
    "Why: DROP TABLE deletes every row of the table first, and that fires ON DELETE",
    "in the tables that point at it. The rows are lost even though the migration",
    `copies the table into "new_${example}" and renames it back. PRAGMA foreign_keys=OFF`,
    "does not prevent it: D1 runs a migration inside a transaction, where SQLite",
    "ignores that PRAGMA. A scratch SQLite database does not show the loss.",
    "",
    "What to do: write this migration by hand instead.",
    `  - To add a column: ALTER TABLE "${example}" ADD COLUMN ...;`,
    "    RENAME COLUMN and DROP COLUMN change a table in place the same way.",
    "  - If the table has to be rebuilt: copy the rows of the tables listed above",
    "    aside first, and put them back after the rename.",
    "  - If the table is being removed: drop the tables that point at it first.",
    "  A hand-written file that still drops the table must be added to",
    "  REVIEWED_TABLE_DROPS in scripts/migration-safety.mjs once you have checked it.",
    "  src/lib/migration-safety.test.ts shows the loss and each way round it.",
  );
  return lines.join("\n");
}
