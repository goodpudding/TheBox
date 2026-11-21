import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const findUser = vi.fn();
/** The DisplayPhotoBlob table behind the mocked client. */
const blobs = new Map<string, { id: string; dataBase64: string }>();

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (args: unknown) => findUser(args) },
    displayPhotoBlob: {
      async create(args: { data: { id: string; dataBase64: string } }) {
        blobs.set(args.data.id, { ...args.data });
        return args.data;
      },
      async findUnique(args: { where: { id: string } }) {
        return blobs.get(args.where.id) ?? null;
      },
      async deleteMany(args: { where: { id: string } }) {
        return { count: blobs.delete(args.where.id) ? 1 : 0 };
      },
    },
  },
}));

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];

function jpeg(size = JPEG_HEAD.length): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(JPEG_HEAD);
  return bytes;
}

function userRow(role: string) {
  const at = new Date("2026-01-01T00:00:00Z");
  return {
    id: "u1",
    email: "u1@example.com",
    firstName: "A",
    lastName: "B",
    displayName: "A B",
    role,
    status: "active",
    tier: "maker",
    shopAccess: true,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
}

function signIn(role: string | null) {
  if (!role) {
    auth.mockResolvedValue(null);
    return;
  }
  auth.mockResolvedValue({ user: { id: "u1" } });
  findUser.mockResolvedValue(userRow(role));
}

async function upload(bytes: Uint8Array | null, type = "image/jpeg") {
  const form = new FormData();
  if (bytes) form.append("file", new File([bytes as BlobPart], "p.jpg", { type }));
  const { POST } = await import("./route");
  return POST(
    new Request("https://discoverburienmakerspace.com/api/display/photos", {
      method: "POST",
      body: form,
    }) as never,
  );
}

async function fetchPhoto(id: string, method: "GET" | "DELETE" = "GET") {
  const route = await import("./[id]/route");
  const request = new Request(
    `https://discoverburienmakerspace.com/api/display/photos/${id}`,
    { method },
  );
  return route[method](request as never, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  auth.mockReset();
  findUser.mockReset();
  blobs.clear();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "production");
});

describe("POST /api/display/photos", () => {
  it("refuses an upload from someone who is not signed in", async () => {
    signIn(null);
    expect((await upload(jpeg())).status).toBe(401);
    expect(blobs.size).toBe(0);
  });

  it("refuses an upload from a member who is not staff", async () => {
    signIn("member");
    expect((await upload(jpeg())).status).toBe(403);
    expect(blobs.size).toBe(0);
  });

  it("stores a staff member's photo and returns where it is served", async () => {
    signIn("admin");
    const res = await upload(jpeg(2000));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; url: string; mimeType: string };
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.url).toBe(`/api/display/photos/${body.id}`);
    expect(body.mimeType).toBe("image/jpeg");
    expect(blobs.has(body.id)).toBe(true);
  });

  it("refuses a file that is not an image, whatever it claims to be", async () => {
    signIn("admin");
    const html = new TextEncoder().encode("<html><script>1</script></html>");
    const res = await upload(html, "image/jpeg");
    expect(res.status).toBe(415);
    expect(blobs.size).toBe(0);
  });

  it("refuses a photo over 1,400,000 bytes, which D1 could not hold", async () => {
    signIn("admin");
    const res = await upload(jpeg(1_400_001));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toMatch(/too large/i);
    expect(blobs.size).toBe(0);
    expect((await upload(jpeg(1_400_000))).status).toBe(200);
  });

  it("refuses a request with no file", async () => {
    signIn("admin");
    expect((await upload(null)).status).toBe(400);
  });
});

describe("GET and DELETE /api/display/photos/[id]", () => {
  it("serves a stored photo to anyone, cacheable and locked down", async () => {
    signIn("admin");
    const { id } = (await (await upload(jpeg(2000))).json()) as { id: string };
    signIn(null);
    const res = await fetchPhoto(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(jpeg(2000));
  });

  it("answers 404 for an unknown id and for anything that is not an id", async () => {
    expect((await fetchPhoto("44444444-4444-4444-8444-444444444444")).status).toBe(404);
    expect((await fetchPhoto("..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
    expect((await fetchPhoto("not-an-id")).status).toBe(404);
  });

  it("will not serve stored bytes that are not an image", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    blobs.set(id, { id, dataBase64: Buffer.from("<svg onload=1>").toString("base64") });
    expect((await fetchPhoto(id)).status).toBe(404);
  });

  it("lets staff delete a photo, and nobody else", async () => {
    signIn("admin");
    const { id } = (await (await upload(jpeg(2000))).json()) as { id: string };
    signIn("member");
    expect((await fetchPhoto(id, "DELETE")).status).toBe(403);
    expect(blobs.has(id)).toBe(true);
    signIn("admin");
    expect((await fetchPhoto(id, "DELETE")).status).toBe(204);
    expect(blobs.has(id)).toBe(false);
    expect((await fetchPhoto(id)).status).toBe(404);
  });
});
