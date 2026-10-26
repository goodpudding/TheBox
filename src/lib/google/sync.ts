/**
 * Drive → portal sync orchestration. Used by `scripts/sync-google.ts`; safe to
 * call from a future "Sync now" route as well.
 *
 *   syncContentDocs   Content/ Docs (+ optional Content Index sheet) → ContentPage
 *   syncMediaFolders  Flyers/ and Photos/* → public/… + a drive-manifest.json per folder
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { GoogleCmsConfig } from "./config";
import { DriveClient, MIME, isGoogleNative, type DriveFile } from "./drive";
import {
  CONTENT_FOLDER,
  MANIFEST_FILE,
  MEDIA_TARGETS,
  exportMimeForMedia,
  googleDocHtmlToContentHtml,
  isSupportedMedia,
  parseContentIndexCsv,
  resolveDocFromPath,
  safeFileName,
  type ContentIndexRow,
  type MediaManifest,
  type MediaManifestEntry,
  type MediaTarget,
} from "./content";
import {
  unpublishMissingDrivePages,
  upsertContentPageFromDrive,
  type UpsertResult,
} from "./content-pages";

export interface SyncLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface SyncOptions {
  dryRun?: boolean;
  log?: SyncLogger;
}

const silent: SyncLogger = { info() {}, warn() {} };

/* ------------------------------------------------------------------ */
/* Content Docs                                                        */
/* ------------------------------------------------------------------ */

interface DiscoveredDoc {
  file: DriveFile;
  folders: string[];
}

async function walkContentFolder(
  drive: DriveClient,
  folderId: string,
  folders: string[] = [],
  depth = 0,
): Promise<DiscoveredDoc[]> {
  if (depth > 4) return [];
  const out: DiscoveredDoc[] = [];
  for (const child of await drive.listChildren(folderId)) {
    if (child.mimeType === MIME.folder) {
      out.push(
        ...(await walkContentFolder(
          drive,
          child.id,
          [...folders, child.name],
          depth + 1,
        )),
      );
    } else if (child.mimeType === MIME.doc) {
      out.push({ file: child, folders });
    }
  }
  return out;
}

export interface ContentSyncSummary {
  results: UpsertResult[];
  unpublished: string[];
  skipped: string[];
}

export async function syncContentDocs(
  drive: DriveClient,
  config: GoogleCmsConfig,
  prisma: PrismaClient | null,
  options: SyncOptions = {},
): Promise<ContentSyncSummary> {
  const log = options.log ?? silent;
  const dryRun = options.dryRun ?? false;
  const results: UpsertResult[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  // 1. Optional Content Index sheet: explicit slug/category/version per Doc.
  const index = new Map<string, ContentIndexRow>();
  if (config.contentIndexSheetId) {
    try {
      const csv = await drive.exportSheetCsv(config.contentIndexSheetId);
      for (const row of parseContentIndexCsv(csv)) index.set(row.fileId, row);
      log.info(`Content Index: ${index.size} row(s) with a Doc link.`);
    } catch (err) {
      log.warn(
        `Content Index sheet could not be read (${(err as Error).message}). Falling back to folder layout.`,
      );
    }
  }

  // 2. Discover Docs under Content/ (any Doc listed in the index is included too).
  const contentFolder = await drive.findChildFolder(config.folderId, CONTENT_FOLDER);
  const docs: DiscoveredDoc[] = contentFolder
    ? await walkContentFolder(drive, contentFolder.id)
    : [];
  if (!contentFolder) {
    log.warn(
      `No "${CONTENT_FOLDER}/" folder found under the shared folder — no Docs synced.`,
    );
  }
  for (const row of index.values()) {
    if (!docs.some((d) => d.file.id === row.fileId)) {
      try {
        const file = await drive.getFile(row.fileId);
        if (file.mimeType === MIME.doc) docs.push({ file, folders: [] });
      } catch (err) {
        log.warn(`Index row "${row.slug}" points at an unreadable file: ${(err as Error).message}`);
      }
    }
  }

  // 3. Export, clean, upsert.
  for (const { file, folders } of docs) {
    const fromPath = resolveDocFromPath(file.name, folders);
    const row = index.get(file.id);
    const slug = row?.slug ?? fromPath.slug;
    const title = row?.title ?? fromPath.title;
    const category = row?.category ?? fromPath.category;
    const version = row?.version ?? fromPath.version ?? null;
    const published = row?.published ?? true;

    if (!slug) {
      skipped.push(file.name);
      log.warn(`Skipped "${file.name}" — could not derive a slug.`);
      continue;
    }
    seen.add(file.id);

    const exportHtml = await drive.exportDocHtml(file.id);
    const html = googleDocHtmlToContentHtml(exportHtml);
    const where = folders.length ? `${folders.join("/")}/` : "";

    if (dryRun || !prisma) {
      log.info(
        `[dry-run] ${category.padEnd(9)} ${slug.padEnd(32)} ← Content/${where}${file.name} (${html.length} chars)`,
      );
      results.push({ id: `dry-${file.id}`, slug, action: "unchanged", versionChanged: false });
      continue;
    }

    const result = await upsertContentPageFromDrive(prisma, {
      googleFileId: file.id,
      slug,
      title,
      html,
      category,
      version,
      published,
    });
    results.push(result);
    log.info(
      `${result.action.padEnd(9)} ${category.padEnd(9)} ${slug.padEnd(32)} ← Content/${where}${file.name}` +
        (result.versionChanged ? `  (version → ${version})` : ""),
    );
  }

  // 4. Anything previously synced from Drive that vanished gets unpublished.
  let unpublished: string[] = [];
  if (prisma && !dryRun && docs.length > 0) {
    unpublished = await unpublishMissingDrivePages(prisma, seen);
    for (const slug of unpublished) log.warn(`unpublished ${slug} (Doc no longer in Drive)`);
  }

  return { results, unpublished, skipped };
}

/* ------------------------------------------------------------------ */
/* Media folders                                                       */
/* ------------------------------------------------------------------ */

export interface MediaSyncSummary {
  target: MediaTarget;
  found: boolean;
  downloaded: number;
  unchanged: number;
  skipped: string[];
  manifestPath: string;
}

async function readManifest(file: string): Promise<MediaManifest | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as MediaManifest;
  } catch {
    return null;
  }
}

async function localMd5(file: string): Promise<string | null> {
  try {
    return createHash("md5").update(await readFile(file)).digest("hex");
  } catch {
    return null;
  }
}

export async function syncMediaFolders(
  drive: DriveClient,
  config: GoogleCmsConfig,
  publicRoot: string,
  options: SyncOptions = {},
  targets: MediaTarget[] = MEDIA_TARGETS,
): Promise<MediaSyncSummary[]> {
  const log = options.log ?? silent;
  const dryRun = options.dryRun ?? false;
  const summaries: MediaSyncSummary[] = [];

  for (const target of targets) {
    const destDir = path.join(publicRoot, ...target.publicDir.split("/"));
    const manifestPath = path.join(destDir, MANIFEST_FILE);
    const summary: MediaSyncSummary = {
      target,
      found: false,
      downloaded: 0,
      unchanged: 0,
      skipped: [],
      manifestPath,
    };
    summaries.push(summary);

    const folder = await drive.resolveFolderPath(config.folderId, target.drivePath);
    if (!folder) {
      log.warn(`${target.label}: no "${target.drivePath}/" folder in Drive — skipped.`);
      continue;
    }
    summary.found = true;

    const previous = await readManifest(manifestPath);
    const entries: MediaManifestEntry[] = [];
    const usedNames = new Set<string>();

    for (const file of await drive.listChildren(folder.id)) {
      if (file.mimeType === MIME.folder) {
        summary.skipped.push(`${file.name}/ (subfolders are not synced)`);
        continue;
      }
      if (!isSupportedMedia(file.mimeType)) {
        summary.skipped.push(`${file.name} (${file.mimeType})`);
        continue;
      }

      const exportAs = isGoogleNative(file) ? exportMimeForMedia(file.mimeType) : null;
      let fileName = exportAs
        ? `${safeFileName(file.name).replace(/\.[a-z0-9]+$/, "")}.${exportAs.ext}`
        : safeFileName(file.name);
      if (usedNames.has(fileName)) {
        const dot = fileName.lastIndexOf(".");
        fileName =
          dot > 0
            ? `${fileName.slice(0, dot)}-${file.id.slice(0, 6)}${fileName.slice(dot)}`
            : `${fileName}-${file.id.slice(0, 6)}`;
      }
      usedNames.add(fileName);

      const dest = path.join(destDir, fileName);
      const url = `/${target.publicDir}/${fileName}`;
      const entry: MediaManifestEntry = {
        url,
        fileName,
        driveFileId: file.id,
        driveName: file.name,
        mimeType: exportAs?.mime ?? file.mimeType,
        modifiedTime: file.modifiedTime ?? null,
        md5: file.md5Checksum ?? null,
        size: file.size ? Number(file.size) : null,
        description: file.description ?? null,
      };
      entries.push(entry);

      // Skip the download when nothing changed since last sync.
      const prev = previous?.files.find((f) => f.driveFileId === file.id);
      const sameBinary =
        file.md5Checksum && (await localMd5(dest)) === file.md5Checksum;
      const sameNative =
        exportAs &&
        Boolean(file.modifiedTime) &&
        prev?.modifiedTime === file.modifiedTime &&
        prev?.fileName === fileName &&
        (await localMd5(dest)) !== null;
      if (sameBinary || sameNative) {
        summary.unchanged += 1;
        continue;
      }

      if (dryRun) {
        log.info(`[dry-run] ${target.label}: would write ${url} ← ${file.name}`);
        summary.downloaded += 1;
        continue;
      }

      const bytes = exportAs
        ? await drive.exportFile(file.id, exportAs.mime)
        : await drive.downloadFile(file.id);
      await mkdir(destDir, { recursive: true });
      await writeFile(dest, bytes);
      summary.downloaded += 1;
      log.info(`${target.label}: wrote ${url} (${bytes.length} bytes)`);
    }

    if (!dryRun) {
      await mkdir(destDir, { recursive: true });
      const manifest: MediaManifest = {
        source: `${target.drivePath} (${folder.id})`,
        syncedAt: new Date().toISOString(),
        files: entries,
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    }
    for (const s of summary.skipped) log.warn(`${target.label}: skipped ${s}`);
    log.info(
      `${target.label}: ${summary.downloaded} written, ${summary.unchanged} unchanged` +
        (summary.skipped.length ? `, ${summary.skipped.length} skipped` : ""),
    );
  }

  return summaries;
}
