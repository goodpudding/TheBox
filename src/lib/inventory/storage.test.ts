import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("local photo storage", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "box-photos-"));
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", "");
    vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "");
    vi.spyOn(process, "cwd").mockReturnValue(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a photo it stored", async () => {
    const { putPhoto, getPhoto } = await import("./storage");
    const { storageKey } = await putPhoto({
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: "image/jpeg",
      folder: "temp",
    });
    const photo = await getPhoto(storageKey);
    expect(photo?.mimeType).toBe("image/jpeg");
    expect(photo?.bytes.length).toBe(3);
  });

  it("issues keys that the inventory write methods accept", async () => {
    const { putPhoto } = await import("./storage");
    const { isIssuedPhotoKey } = await import("./upload-policy");
    for (const [mimeType, folder] of [
      ["image/jpeg", "temp"],
      ["image/png", "temp"],
      ["image/webp", "BX-00042"],
    ] as const) {
      const { storageKey } = await putPhoto({
        bytes: Buffer.from([0xff, 0xd8, 0xff]),
        mimeType,
        folder,
      });
      expect(isIssuedPhotoKey(storageKey), storageKey).toBe(true);
    }
  });

  it("refuses a key that climbs out of the photo directory", async () => {
    await writeFile(path.join(root, "secret.png"), "top secret");
    await mkdir(path.join(root, ".data", "inventory-photos"), { recursive: true });
    const { getPhoto } = await import("./storage");
    expect(await getPhoto("local:../../secret.png")).toBeNull();
    expect(await getPhoto("local:temp/../../../secret.png")).toBeNull();
  });

  it("will not delete outside the photo directory", async () => {
    const outside = path.join(root, "keep.png");
    await writeFile(outside, "keep me");
    await mkdir(path.join(root, ".data", "inventory-photos"), { recursive: true });
    const { deletePhoto, getPhoto } = await import("./storage");
    await deletePhoto("local:../../keep.png");
    const { readFile } = await import("node:fs/promises");
    expect((await readFile(outside)).toString()).toBe("keep me");
    expect(await getPhoto("local:missing.jpg")).toBeNull();
  });
});

describe("database photo storage", () => {
  const rows = new Map<string, { id: string; mimeType: string; bytes: Uint8Array; folder: string }>();
  const mkdirSpy = vi.fn();

  beforeEach(() => {
    rows.clear();
    mkdirSpy.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
    // The live site: a production build that keeps its data in the database.
    vi.stubEnv("DATA_PROVIDER", "prisma");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", "");
    vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "");
    vi.stubEnv("INVENTORY_PHOTO_STORAGE", "");
    vi.doMock("@/lib/db", () => ({
      prisma: {
        storedFile: {
          create: async ({ data }: { data: { id: string; mimeType: string; bytes: Uint8Array; folder: string } }) => {
            rows.set(data.id, data);
            return data;
          },
          findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
          deleteMany: async ({ where }: { where: { id: string } }) => ({
            count: rows.delete(where.id) ? 1 : 0,
          }),
        },
      },
    }));
    // A Worker has no disk to write to. Any attempt is the bug.
    vi.doMock("node:fs/promises", async (importOriginal) => ({
      ...(await importOriginal<typeof import("node:fs/promises")>()),
      mkdir: async (...args: unknown[]) => {
        mkdirSpy(...args);
        throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock("@/lib/db");
    vi.doUnmock("node:fs/promises");
    vi.restoreAllMocks();
  });

  it("keeps an upload in the database and never touches the disk", async () => {
    const { putPhoto, getPhoto } = await import("./storage");
    const { storageKey } = await putPhoto({
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0x01]),
      mimeType: "image/jpeg",
      folder: "temp",
    });
    expect(storageKey).toMatch(/^db:[0-9a-f-]{36}$/);
    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(rows.size).toBe(1);
    const photo = await getPhoto(storageKey);
    expect(photo?.mimeType).toBe("image/jpeg");
    expect([...photo!.bytes]).toEqual([0xff, 0xd8, 0xff, 0x01]);
  });

  it("issues keys that the inventory write methods accept", async () => {
    const { putPhoto } = await import("./storage");
    const { isIssuedPhotoKey } = await import("./upload-policy");
    const { storageKey } = await putPhoto({
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: "image/jpeg",
    });
    expect(isIssuedPhotoKey(storageKey), storageKey).toBe(true);
    expect(isIssuedPhotoKey("db:not-a-uuid")).toBe(false);
  });

  it("refuses a photo too large for one database row, with a message for the member", async () => {
    const { putPhoto } = await import("./storage");
    const { MAX_STORED_PHOTO_BYTES, PhotoRejectedError } = await import("./upload-policy");
    const big = Buffer.alloc(MAX_STORED_PHOTO_BYTES + 1, 1);
    const attempt = putPhoto({ bytes: big, mimeType: "image/jpeg" });
    await expect(attempt).rejects.toBeInstanceOf(PhotoRejectedError);
    await expect(attempt).rejects.toMatchObject({ status: 413 });
    expect(rows.size).toBe(0);
  });

  it("stays on the database when Google is set up but Drive was not asked for", async () => {
    vi.stubEnv(
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      JSON.stringify({ client_email: "sa@example.iam.gserviceaccount.com", private_key: "k" }),
    );
    vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "folder-123");
    const { putPhoto } = await import("./storage");
    const { storageKey } = await putPhoto({
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: "image/jpeg",
    });
    expect(storageKey.startsWith("db:")).toBe(true);
  });

  it("deletes the row for a key it issued and ignores other keys", async () => {
    const { putPhoto, deletePhoto, getPhoto } = await import("./storage");
    const { storageKey } = await putPhoto({
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: "image/jpeg",
    });
    await deletePhoto("db:00000000-0000-0000-0000-000000000000");
    expect(rows.size).toBe(1);
    await deletePhoto(storageKey);
    expect(rows.size).toBe(0);
    expect(await getPhoto(storageKey)).toBeNull();
  });

  it("returns nothing for a database key that was never issued", async () => {
    const { getPhoto } = await import("./storage");
    expect(await getPhoto("db:00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getPhoto("db:../../etc/passwd")).toBeNull();
  });
});
