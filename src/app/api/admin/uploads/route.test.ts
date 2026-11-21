import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const putPhoto = vi.fn();

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/inventory/storage", () => ({
  putPhoto: (input: unknown) => putPhoto(input),
}));

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function upload(file?: File) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("https://discoverburienmakerspace.com/api/admin/uploads", {
    method: "POST",
    body: form,
  });
}

async function post(request: Request) {
  const { POST } = await import("./route");
  return POST(request as never);
}

describe("POST /api/admin/uploads", () => {
  beforeEach(() => {
    auth.mockReset();
    putPhoto.mockReset();
    putPhoto.mockResolvedValue({ storageKey: "db:11111111-2222-3333-4444-555555555555" });
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
  });

  it("refuses a visitor and a member on the live site", async () => {
    auth.mockResolvedValue(null);
    expect((await post(upload(new File([JPEG], "a.jpg")))).status).toBe(401);
    auth.mockResolvedValue({ user: { id: "u-maya", role: "member" } });
    expect((await post(upload(new File([JPEG], "a.jpg")))).status).toBe(403);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("stores a staff picture and answers with the address to show it from", async () => {
    auth.mockResolvedValue({ user: { id: "u-admin", role: "admin" } });
    const res = await post(upload(new File([JPEG], "a.jpg")));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { url: string }).url).toBe(
      "/api/inventory/photos/db%3A11111111-2222-3333-4444-555555555555",
    );
    expect(putPhoto.mock.calls[0]![0]).toMatchObject({ mimeType: "image/jpeg", folder: "gallery" });
  });

  it("refuses a file that is not a picture", async () => {
    auth.mockResolvedValue({ user: { id: "u-admin", role: "admin" } });
    const res = await post(upload(new File(["<script>alert(1)</script>"], "a.jpg")));
    expect(res.status).toBe(415);
    expect(putPhoto).not.toHaveBeenCalled();
  });
});
