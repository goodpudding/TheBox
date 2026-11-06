import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const findUnique = vi.fn();

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: (args: unknown) => findUnique(args) } },
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});

function row(role: string) {
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
    isTeacher: false,
    profileComplete: true,
    createdAt: at,
    updatedAt: at,
  };
}

async function get() {
  const { GET } = await import("./route");
  return GET(new Request("https://thebox.test/api/admin/display/kiosk-url"));
}

describe("/api/admin/display/kiosk-url", () => {
  beforeEach(() => {
    auth.mockReset();
    findUnique.mockReset();
    vi.unstubAllEnvs();
  });

  it("requires a session", async () => {
    auth.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it("rejects a member", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(row("member"));
    expect((await get()).status).toBe(403);
  });

  it("returns the kiosk URL with the runtime token for staff", async () => {
    vi.stubEnv("DISPLAY_TOKEN", "s3cret token");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://discoverburienmakerspace.com/");
    auth.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(row("staff"));
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://discoverburienmakerspace.com/display?token=s3cret%20token",
    });
  });

  it("fails closed in production without DISPLAY_TOKEN", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISPLAY_TOKEN", "");
    auth.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(row("admin"));
    expect((await get()).status).toBe(503);
  });
});
