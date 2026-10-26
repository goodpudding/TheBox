/**
 * Sync the shared Google Drive folder ("The Box Website") into the portal.
 *
 *   Content/**  Google Docs  → ContentPage (waiver, hours, policies, learning, …)
 *   Flyers/                  → public/uploads/flyers
 *   Photos/Made here/        → public/images/projects
 *   Photos/Promos/           → public/uploads/promos
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON     service-account key (inline JSON or a file path)
 *   GOOGLE_DRIVE_FOLDER_ID          the shared folder id
 *   GOOGLE_CONTENT_INDEX_SHEET_ID   optional Content Index sheet
 *   DATABASE_URL                    Prisma (only needed for the Docs → ContentPage half)
 *
 * Usage:
 *   npm run sync:google                  full sync
 *   npm run sync:google -- --dry-run     list what would change, write nothing
 *   npm run sync:google -- --content     Docs only
 *   npm run sync:google -- --media       Flyers/Photos only (no database needed)
 *
 * Without credentials, prints the setup steps and exits 0 (safe for CI/Vercel).
 * Classes still come from the Schedule sheet CSV import (scripts/import-winter-schedule.mjs);
 * Zeffy stays the payment/ticket system (scripts/sync-zeffy.ts).
 */
import path from "node:path";
import {
  GOOGLE_ENV_KEYS,
  DriveClient,
  MEDIA_TARGETS,
  ServiceAccountTokenSource,
  getGoogleCmsConfig,
  syncContentDocs,
  syncMediaFolders,
  type SyncLogger,
} from "../src/lib/google";

const SETUP_HELP = `Google Drive CMS sync is ready to connect.

A. Drive folder (staff-facing, no code)
   Create a shared folder "The Box Website" laid out like this:
     The Box Website/
       Schedule / Class Catalog   ← the existing spreadsheet (classes stay on the Sheet)
       Content/                   ← Google Docs, one per page
         Waiver                   ← slug "waiver" (add " v2026.2" to the title to bump the version)
         Hours                    ← slug "hours"
         Policies/…               ← one Doc per policy page
         Learning/<Module>/…      ← lesson copy
       Content Index              ← optional Sheet: slug | title | category | doc | published | version
       Flyers/                    ← event flyer PDFs / images
       Photos/Made here/          ← gallery images
       Photos/Promos/             ← lobby display images
   Share the folder with whoever edits content.

B. Google Cloud (one-time)
   1. console.cloud.google.com → new or existing project
   2. Enable the Google Drive API
   3. IAM & Admin → Service accounts → Create → Keys → Add key (JSON) → download
   4. In Drive, share "The Box Website" with the service-account email as Viewer
   5. Copy ids from URLs: drive.google.com/drive/folders/FOLDER_ID

C. Env (local .env or Vercel → Settings → Environment Variables)
   GOOGLE_SERVICE_ACCOUNT_JSON=<the whole key JSON on one line, or a path to the .json file>
   GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID>
   GOOGLE_CONTENT_INDEX_SHEET_ID=<optional>
   DATABASE_URL=<Prisma; needed for Docs → ContentPage>

D. Run
   npm run sync:google -- --dry-run     # preview
   npm run sync:google                  # sync, then redeploy

Nothing was changed. Mock content in data/mock/content stays in use until this runs.
`;

const logger: SyncLogger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(`  ! ${m}`),
};

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const only = flags.has("--content") ? "content" : flags.has("--media") ? "media" : "all";
  return { dryRun: flags.has("--dry-run") || flags.has("-n"), only };
}

async function main() {
  const config = getGoogleCmsConfig();
  if (!config) {
    const missing = GOOGLE_ENV_KEYS.filter((k) => !process.env[k]?.trim());
    console.log(SETUP_HELP);
    if (missing.length < GOOGLE_ENV_KEYS.length) {
      console.log(
        `Partially configured — still missing or invalid: ${missing
          .filter((k) => k === "GOOGLE_SERVICE_ACCOUNT_JSON" || k === "GOOGLE_DRIVE_FOLDER_ID")
          .join(", ") || "GOOGLE_SERVICE_ACCOUNT_JSON (could not be parsed)"}\n`,
      );
    }
    return;
  }

  const { dryRun, only } = parseArgs(process.argv.slice(2));
  const drive = new DriveClient(new ServiceAccountTokenSource(config.serviceAccount));
  const root = path.resolve(process.cwd());

  console.log(
    `Google Drive CMS sync${dryRun ? " (dry run)" : ""} — folder ${config.folderId} as ${config.serviceAccount.client_email}\n`,
  );

  if (only !== "media") {
    console.log("Content Docs → ContentPage");
    let prisma: import("@prisma/client").PrismaClient | null = null;
    if (!dryRun) {
      if (!process.env.DATABASE_URL) {
        logger.warn("DATABASE_URL is not set — showing Docs as a dry run instead.");
      } else {
        const { PrismaClient } = await import("@prisma/client");
        prisma = new PrismaClient();
      }
    }
    try {
      const summary = await syncContentDocs(drive, config, prisma, {
        dryRun: dryRun || !prisma,
        log: logger,
      });
      const counts = summary.results.reduce(
        (acc, r) => ({ ...acc, [r.action]: (acc[r.action] ?? 0) + 1 }),
        {} as Record<string, number>,
      );
      console.log(
        `  ${summary.results.length} Doc(s): ${Object.entries(counts)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ") || "none"}` +
          (summary.unpublished.length ? `, ${summary.unpublished.length} unpublished` : "") +
          (summary.skipped.length ? `, ${summary.skipped.length} skipped` : "") +
          "\n",
      );
    } finally {
      await prisma?.$disconnect();
    }
  }

  if (only !== "content") {
    console.log("Media folders → public/");
    const summaries = await syncMediaFolders(
      drive,
      config,
      path.join(root, "public"),
      { dryRun, log: logger },
      MEDIA_TARGETS,
    );
    const missing = summaries.filter((s) => !s.found);
    if (missing.length) {
      console.log(
        `  Folders not found in Drive: ${missing.map((s) => s.target.drivePath).join(", ")}`,
      );
    }
    console.log("");
  }

  console.log(dryRun ? "Dry run complete — nothing written." : "Google Drive sync complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
