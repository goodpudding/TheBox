import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

describe("listPeople", () => {
  it("returns published staff and instructors in sort order", async () => {
    const provider = createMockDataProvider();
    const all = await provider.listPeople();
    expect(all.map((p) => p.slug)).toEqual([
      "mitchell-allen",
      "denise-ferguson",
      "debra-george",
      "martha-cabello",
      "wilson-benjamin",
      "paul-illian",
      "wendy",
      "matt-swanson",
    ]);
  });

  it("filters by kind", async () => {
    const provider = createMockDataProvider();
    const staff = await provider.listPeople("staff");
    const instructors = await provider.listPeople("instructor");
    expect(staff.every((p) => p.kind === "staff")).toBe(true);
    expect(instructors.every((p) => p.kind === "instructor")).toBe(true);
    expect(staff.map((p) => p.name)).toContain("Mitchell Allen");
    expect(instructors.map((p) => p.name)).toEqual([
      "Paul Illian",
      "Wendy",
      "Matt Swanson",
    ]);
  });

  it("serves history and staff CMS pages", async () => {
    const provider = createMockDataProvider();
    const history = await provider.getContentBySlug("history");
    const staff = await provider.getContentBySlug("staff");
    expect(history?.title).toBe("How The Box got here");
    expect(history?.html).toMatch(/October 2021/);
    expect(staff?.title).toBe("Staff & instructors");
    expect(staff?.html).toMatch(/Discover Burien/);
  });
});
