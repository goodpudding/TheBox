import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const findUnique = vi.fn();
const putPhoto = vi.fn();

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: (args: unknown) => findUnique(args) } },
}));
vi.mock("@/lib/inventory/storage", () => ({
  putPhoto: (input: unknown) => putPhoto(input),
}));

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function upload(parts: { file?: File; thumb?: File }) {
  const form = new FormData();
  if (parts.file) form.append("file", parts.file);
  if (parts.thumb) form.append("thumb", parts.thumb);
  return new Request("https://discoverburienmakerspace.com/api/inventory/uploads", {
    method: "POST",
    body: form,
  });
}

function jpegFile(name = "front.jpg") {
  return new File([JPEG], name, { type: "image/jpeg" });
}

async function post(request: Request) {
  const { POST } = await import("./route");
  return POST(request as never);
}

describe("POST /api/inventory/uploads", () => {
  beforeEach(() => {
    auth.mockReset();
    findUnique.mockReset();
    putPhoto.mockReset();
    putPhoto.mockResolvedValue({ storageKey: "drive:abc" });
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
  });

  it("refuses an anonymous upload on the live site", async () => {
    auth.mockResolvedValue(null);
    const res = await post(upload({ file: jpegFile() }));
    expect(res.status).toBe(401);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("refuses a session whose member no longer exists", async () => {
    auth.mockResolvedValue({ user: { id: "u-gone" } });
    findUnique.mockResolvedValue(null);
    const res = await post(upload({ file: jpegFile() }));
    expect(res.status).toBe(401);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("refuses a suspended member", async () => {
    auth.mockResolvedValue({ user: { id: "u-sus" } });
    findUnique.mockResolvedValue({ id: "u-sus", status: "suspended", deletedAt: null });
    const res = await post(upload({ file: jpegFile() }));
    expect(res.status).toBe(403);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("stores a signed-in member's jpeg under the sniffed type", async () => {
    auth.mockResolvedValue({ user: { id: "u-maya" } });
    findUnique.mockResolvedValue({ id: "u-maya", status: "active", deletedAt: null });
    const res = await post(upload({ file: jpegFile() }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { storageKey: string; mimeType: string };
    expect(body.storageKey).toBe("drive:abc");
    expect(body.mimeType).toBe("image/jpeg");
    expect(putPhoto).toHaveBeenCalledTimes(1);
    expect(putPhoto.mock.calls[0]![0]).toMatchObject({
      mimeType: "image/jpeg",
      folder: "temp",
    });
  });

  it("rejects html that claims to be an image, before anything is stored", async () => {
    auth.mockResolvedValue({ user: { id: "u-maya" } });
    findUnique.mockResolvedValue({ id: "u-maya", status: "active", deletedAt: null });
    const evil = new File(["<html><script>alert(1)</script></html>"], "x.jpg", {
      type: "image/jpeg",
    });
    const res = await post(upload({ file: evil }));
    expect(res.status).toBe(415);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("rejects a bad thumbnail without storing the main photo", async () => {
    auth.mockResolvedValue({ user: { id: "u-maya" } });
    findUnique.mockResolvedValue({ id: "u-maya", status: "active", deletedAt: null });
    const thumb = new File(["<svg/>"], "t.svg", { type: "image/svg+xml" });
    const res = await post(upload({ file: jpegFile(), thumb }));
    expect(res.status).toBe(415);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is sent", async () => {
    auth.mockResolvedValue({ user: { id: "u-maya" } });
    findUnique.mockResolvedValue({ id: "u-maya", status: "active", deletedAt: null });
    const res = await post(upload({}));
    expect(res.status).toBe(400);
  });

  it("lets the fixture UI upload without a session in local dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    auth.mockResolvedValue(null);
    const res = await post(upload({ file: jpegFile() }));
    expect(res.status).toBe(200);
  });
});
