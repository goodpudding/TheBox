import { beforeEach, describe, expect, it, vi } from "vitest";

const getPhoto = vi.fn();

vi.mock("@/lib/inventory/storage", () => ({
  getPhoto: (key: string) => getPhoto(key),
}));

async function get(id: string) {
  const { GET } = await import("./route");
  return GET(new Request("https://discoverburienmakerspace.com/x"), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/inventory/photos/[id]", () => {
  beforeEach(() => {
    getPhoto.mockReset();
  });

  it("serves a jpeg with nosniff and a locked-down CSP", async () => {
    getPhoto.mockResolvedValue({
      storageKey: "drive:abc",
      mimeType: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
    });
    const res = await get("drive%3Aabc");
    expect(res.status).toBe(200);
    expect(getPhoto).toHaveBeenCalledWith("drive:abc");
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("will not serve a stored html file from the portal's origin", async () => {
    getPhoto.mockResolvedValue({
      storageKey: "drive:evil",
      mimeType: "text/html",
      bytes: Buffer.from("<script>alert(1)</script>"),
    });
    const res = await get("drive:evil");
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("<script>");
  });

  it("will not serve an uploaded svg", async () => {
    getPhoto.mockResolvedValue({
      storageKey: "drive:svg",
      mimeType: "image/svg+xml",
      bytes: Buffer.from("<svg><script/></svg>"),
    });
    const res = await get("drive:svg");
    expect(res.status).toBe(404);
  });

  it("still serves the generated fixture placeholder svg, sandboxed", async () => {
    getPhoto.mockResolvedValue({
      storageKey: "fixture:table-saw",
      mimeType: "image/svg+xml",
      bytes: Buffer.from("<svg/>"),
    });
    const res = await get("fixture:table-saw");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("returns 404 for a malformed key instead of throwing", async () => {
    const res = await get("%E0%A4%A");
    expect(res.status).toBe(404);
    expect(getPhoto).not.toHaveBeenCalled();
  });

  it("returns 404 when the photo is missing", async () => {
    getPhoto.mockResolvedValue(null);
    const res = await get("drive:nope");
    expect(res.status).toBe(404);
  });
});
