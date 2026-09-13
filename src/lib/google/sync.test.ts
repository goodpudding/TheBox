import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { MIME, type DriveClient, type DriveFile } from "./drive";
import { syncContentDocs, syncMediaFolders, type SyncLogger } from "./sync";
import type { GoogleCmsConfig } from "./config";

/** In-memory Drive: folders keyed by id, plus per-file export/download bodies. */
function fakeDrive(tree: Record<string, DriveFile[]>, bodies: Record<string, string>) {
  const calls = { downloads: 0, exports: 0 };
  const client = {
    async listChildren(folderId: string) {
      return tree[folderId] ?? [];
    },
    async findChildFolder(parentId: string, name: string) {
      return (
        (tree[parentId] ?? []).find(
          (f) => f.mimeType === MIME.folder && f.name.toLowerCase() === name.toLowerCase(),
        ) ?? null
      );
    },
    async resolveFolderPath(rootId: string, p: string) {
      let cur: DriveFile | null = { id: rootId, name: "", mimeType: MIME.folder };
      for (const seg of p.split("/")) {
        if (!cur) return null;
        cur = await client.findChildFolder(cur.id, seg);
      }
      return cur;
    },
    async getFile(id: string) {
      for (const files of Object.values(tree)) {
        const f = files.find((x) => x.id === id);
        if (f) return f;
      }
      throw new Error(`not found ${id}`);
    },
    async exportDocHtml(id: string) {
      calls.exports += 1;
      return bodies[id] ?? "";
    },
    async exportSheetCsv(id: string) {
      return bodies[id] ?? "";
    },
    async exportFile(id: string) {
      calls.exports += 1;
      return Buffer.from(bodies[id] ?? "");
    },
    async downloadFile(id: string) {
      calls.downloads += 1;
      return Buffer.from(bodies[id] ?? "");
    },
  };
  return { drive: client as unknown as DriveClient, calls };
}

const config: GoogleCmsConfig = {
  serviceAccount: { client_email: "svc@example.iam.gserviceaccount.com", private_key: "x" },
  folderId: "root",
  contentIndexSheetId: null,
  scheduleSheetId: null,
};

const doc = (id: string, name: string): DriveFile => ({ id, name, mimeType: MIME.doc });
const folder = (id: string, name: string): DriveFile => ({ id, name, mimeType: MIME.folder });
const png = (id: string, name: string, body: string): DriveFile => ({
  id,
  name,
  mimeType: "image/png",
  md5Checksum: createHash("md5").update(body).digest("hex"),
  modifiedTime: "2026-09-01T00:00:00Z",
  size: String(body.length),
  description: "A caption",
});

const collect = (): SyncLogger & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, info: (m) => lines.push(m), warn: (m) => lines.push(`! ${m}`) };
};

describe("syncContentDocs (dry run — no database)", () => {
  it("walks Content/ recursively and resolves slug/category per folder", async () => {
    const { drive } = fakeDrive(
      {
        root: [folder("content", "Content"), folder("flyers", "Flyers")],
        content: [doc("d-waiver", "Waiver v2026.2"), folder("policies", "Policies"), folder("learning", "Learning")],
        policies: [doc("d-exp", "Member Expectations")],
        learning: [folder("l3d", "3D Printing")],
        l3d: [doc("d-mat", "Materials")],
      },
      {
        "d-waiver": "<html><body><p>Sign here</p></body></html>",
        "d-exp": "<p>Be nice</p>",
        "d-mat": "<p>PLA</p>",
      },
    );
    const log = collect();
    const summary = await syncContentDocs(drive, config, null, { dryRun: true, log });
    expect(summary.results.map((r) => r.slug).sort()).toEqual([
      "3d-printing-materials",
      "member-expectations",
      "waiver",
    ]);
    expect(log.lines.some((l) => l.includes("waiver") && l.includes("Content/Waiver v2026.2"))).toBe(true);
    expect(log.lines.some((l) => l.includes("lesson") && l.includes("Content/Learning/3D Printing/Materials"))).toBe(true);
  });

  it("warns and syncs nothing when Content/ is missing", async () => {
    const { drive } = fakeDrive({ root: [] }, {});
    const log = collect();
    const summary = await syncContentDocs(drive, config, null, { dryRun: true, log });
    expect(summary.results).toHaveLength(0);
    expect(log.lines[0]).toMatch(/No "Content\/" folder/);
  });
});

describe("syncMediaFolders", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "box-media-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("downloads supported files, exports Docs as PDF, writes a manifest, and skips unchanged on re-run", async () => {
    const { drive, calls } = fakeDrive(
      {
        root: [folder("flyers", "Flyers"), folder("photos", "Photos")],
        flyers: [
          png("f1", "Boo in Burien Flyer.png", "PNGDATA"),
          { ...doc("f2", "Cookie Crawl flyer"), modifiedTime: "2026-09-02T00:00:00Z" },
          { id: "f3", name: "notes.txt", mimeType: "text/plain" },
          folder("f4", "Old"),
        ],
        photos: [folder("made", "Made here"), folder("promos", "Promos")],
        made: [png("m1", "Shelf.jpg", "JPG")],
        promos: [],
      },
      { f1: "PNGDATA", f2: "%PDF-1.4 fake", m1: "JPG" },
    );
    const log = collect();
    const first = await syncMediaFolders(drive, config, dir, { log });

    expect(first.map((s) => [s.target.publicDir, s.found, s.downloaded, s.unchanged])).toEqual([
      ["uploads/flyers", true, 2, 0],
      ["images/projects", true, 1, 0],
      ["uploads/promos", true, 0, 0],
    ]);
    expect(first[0].skipped).toEqual(["notes.txt (text/plain)", "Old/ (subfolders are not synced)"]);

    expect((await readFile(path.join(dir, "uploads/flyers/boo-in-burien-flyer.png"))).toString()).toBe("PNGDATA");
    expect((await stat(path.join(dir, "uploads/flyers/cookie-crawl-flyer.pdf"))).size).toBeGreaterThan(0);
    const manifest = JSON.parse(
      await readFile(path.join(dir, "uploads/flyers/drive-manifest.json"), "utf8"),
    );
    expect(manifest.files).toHaveLength(2);
    expect(manifest.files[0]).toMatchObject({
      url: "/uploads/flyers/boo-in-burien-flyer.png",
      driveFileId: "f1",
      driveName: "Boo in Burien Flyer.png",
      description: "A caption",
    });
    expect(manifest.files[1]).toMatchObject({
      url: "/uploads/flyers/cookie-crawl-flyer.pdf",
      mimeType: "application/pdf",
    });
    expect(calls.downloads).toBe(2);
    expect(calls.exports).toBe(1);

    const second = await syncMediaFolders(drive, config, dir, { log });
    expect(second[0]).toMatchObject({ downloaded: 0, unchanged: 2 });
    expect(second[1]).toMatchObject({ downloaded: 0, unchanged: 1 });
    expect(calls.downloads).toBe(2);
    expect(calls.exports).toBe(1);
  });

  it("dry run writes nothing", async () => {
    const { drive } = fakeDrive(
      { root: [folder("flyers", "Flyers")], flyers: [png("f1", "a.png", "X")] },
      { f1: "X" },
    );
    const res = await syncMediaFolders(drive, config, dir, { dryRun: true });
    expect(res[0].downloaded).toBe(1);
    await expect(stat(path.join(dir, "uploads/flyers/a.png"))).rejects.toThrow();
  });
});
