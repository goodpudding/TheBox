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
