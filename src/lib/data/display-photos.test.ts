import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { displayPhotoUrl } from "./display-feed";
import { DISPLAY_PHOTO_LIMIT } from "./provider";

function uuid(n: number): string {
  return `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
}

describe("lobby display photos", () => {
  it("puts active photos in the feed in their set order", async () => {
    const provider = createMockDataProvider(null);
    await provider.saveDisplayPhoto({
      id: uuid(1),
      mimeType: "image/jpeg",
      sortOrder: 0,
    });
    const feed = await provider.getDisplayFeed();
    expect(feed.photos[0]).toEqual({
      id: uuid(1),
      url: `/api/display/photos/${uuid(1)}`,
      caption: null,
    });
    const orders = (await provider.listDisplayPhotos()).map((p) => p.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("serves a fixture photo from its file and an upload by id", () => {
    expect(displayPhotoUrl({ id: uuid(2), staticPath: "/images/a.png" })).toBe(
      "/images/a.png",
    );
    expect(displayPhotoUrl({ id: uuid(2) })).toBe(
      `/api/display/photos/${uuid(2)}`,
    );
  });

  it("leaves hidden and deleted photos out of the feed", async () => {
    const provider = createMockDataProvider(null);
    await provider.saveDisplayPhoto({ id: uuid(3), mimeType: "image/jpeg" });
    await provider.saveDisplayPhoto({ id: uuid(4), mimeType: "image/jpeg" });
    await provider.saveDisplayPhoto({ id: uuid(3), active: false });
    await provider.deleteDisplayPhoto(uuid(4));

    const ids = (await provider.getDisplayFeed()).photos.map((p) => p.id);
    expect(ids).not.toContain(uuid(3));
    expect(ids).not.toContain(uuid(4));
    const listed = (await provider.listDisplayPhotos()).map((p) => p.id);
    expect(listed).toContain(uuid(3));
    expect(listed).not.toContain(uuid(4));
  });

  it("trims a caption and cuts it at 120 characters", async () => {
    const provider = createMockDataProvider(null);
    const saved = await provider.saveDisplayPhoto({
      id: uuid(5),
      mimeType: "image/jpeg",
      caption: `  ${"x".repeat(200)}  `,
    });
    expect(saved.caption).toBe("x".repeat(120));
    const cleared = await provider.saveDisplayPhoto({ id: uuid(5), caption: "  " });
    expect(cleared.caption).toBeNull();
  });

  it("refuses a photo past the limit and says what to do", async () => {
    const provider = createMockDataProvider(null);
    const existing = (await provider.listDisplayPhotos()).length;
    for (let n = existing; n < DISPLAY_PHOTO_LIMIT; n++) {
      await provider.saveDisplayPhoto({ id: uuid(100 + n), mimeType: "image/jpeg" });
    }
    await expect(
      provider.saveDisplayPhoto({ id: uuid(999), mimeType: "image/jpeg" }),
    ).rejects.toThrow("The display holds 60 photos at most. Delete one first.");
    // Editing one that exists still works at the limit.
    await expect(
      provider.saveDisplayPhoto({ id: uuid(100 + existing), caption: "ok" }),
    ).resolves.toMatchObject({ caption: "ok" });
  });

  it("refuses a new photo whose id is not one the upload route issues", async () => {
    const provider = createMockDataProvider(null);
    await expect(
      provider.saveDisplayPhoto({ id: "../etc/passwd", mimeType: "image/jpeg" }),
    ).rejects.toThrow("Unknown photo");
    await expect(provider.saveDisplayPhoto({ id: uuid(6) })).rejects.toThrow(
      "Unknown photo",
    );
  });
});

describe("lobby display motion setting", () => {
  it("saves calm and ignores a value it does not know", async () => {
    const provider = createMockDataProvider(null);
    expect((await provider.getDisplayConfig()).motion).toBe("full");
    expect((await provider.saveDisplayConfig({ motion: "calm" })).motion).toBe(
      "calm",
    );
    const next = await provider.saveDisplayConfig({
      motion: "spin" as never,
    });
    expect(next.motion).toBe("calm");
    expect((await provider.getDisplayFeed()).config.motion).toBe("calm");
  });

  it("keeps the Find us slide in the rotation and lets staff move it", async () => {
    const provider = createMockDataProvider(null);
    const start = await provider.getDisplayConfig();
    expect(start.panelOrder).toContain("findus");
    const moved = await provider.saveDisplayConfig({
      panelOrder: ["findus", "upcoming", "not-a-panel" as never],
    });
    expect(moved.panelOrder).toEqual(["findus", "upcoming"]);
  });

  it("has the event spotlight and community slides in the rotation", async () => {
    const provider = createMockDataProvider(null);
    const start = await provider.getDisplayConfig();
    expect(start.panelOrder).toEqual(
      expect.arrayContaining(["spotlight", "community"]),
    );
    const moved = await provider.saveDisplayConfig({
      panelOrder: ["community", "spotlight", "upcoming"],
    });
    expect(moved.panelOrder).toEqual(["community", "spotlight", "upcoming"]);
  });
});

