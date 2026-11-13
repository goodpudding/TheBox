import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

const LONG = "x".repeat(5000);

describe("public form limits", () => {
  it("volunteer interest rejects oversized fields and bad emails", async () => {
    const provider = createMockDataProvider(null);
    const ok = { name: "Pat", email: "pat@example.com", message: "I can help Saturdays." };
    await expect(
      provider.submitVolunteerInterest({ ...ok, message: LONG }),
    ).rejects.toThrow(/too long/i);
    await expect(
      provider.submitVolunteerInterest({ ...ok, name: LONG }),
    ).rejects.toThrow(/too long/i);
    await expect(
      provider.submitVolunteerInterest({ ...ok, phone: LONG }),
    ).rejects.toThrow(/too long/i);
    await expect(
      provider.submitVolunteerInterest({ ...ok, email: "not-an-email" }),
    ).rejects.toThrow(/valid email/i);
    const saved = await provider.submitVolunteerInterest(ok);
    expect(saved.status).toBe("new");
  });

  it("volunteer interest survives non-string input without a crash message", async () => {
    const provider = createMockDataProvider(null);
    await expect(
      provider.submitVolunteerInterest({
        name: 42,
        email: null,
        message: {},
      } as never),
    ).rejects.toThrow(/required/i);
  });

  it("bounty requests cap the name and business fields", async () => {
    const provider = createMockDataProvider(null);
    const ok = {
      title: "Window decal",
      description: "Storefront name in two colors.",
      requesterName: "Riley",
      requesterEmail: "riley@example.com",
    };
    await expect(
      provider.submitBountyRequest({ ...ok, requesterName: LONG }),
    ).rejects.toThrow(/too long/i);
    await expect(
      provider.submitBountyRequest({ ...ok, businessName: LONG }),
    ).rejects.toThrow(/too long/i);
  });

  it("wishlist purchase reports cap the note", async () => {
    const provider = createMockDataProvider(null);
    const catalog = await provider.getWishlistCatalog();
    const item = catalog.items.find((i) => i.status !== "fulfilled")!;
    await expect(
      provider.reportWishlistPurchase({
        itemId: item.id,
        name: "Pat",
        email: "pat@example.com",
        note: LONG,
      }),
    ).rejects.toThrow(/too long/i);
  });

  it("interest proposals cap text, validate the email, and clamp the threshold", async () => {
    const provider = createMockDataProvider(null);
    const ok = {
      title: "Intro to leatherwork",
      summary: "Basic stitching and edge finishing.",
      contactName: "Pat",
      contactEmail: "pat@example.com",
    };
    await expect(
      provider.proposeInterestBoard({ ...ok, summary: LONG }),
    ).rejects.toThrow(/too long/i);
    await expect(
      provider.proposeInterestBoard({ ...ok, contactEmail: "nope" }),
    ).rejects.toThrow(/valid email/i);
    const zero = await provider.proposeInterestBoard({ ...ok, threshold: 0 });
    expect(zero.threshold).toBeGreaterThanOrEqual(2);
    const huge = await provider.proposeInterestBoard({ ...ok, threshold: 1e9 });
    expect(huge.threshold).toBeLessThanOrEqual(50);
    const nan = await provider.proposeInterestBoard({
      ...ok,
      threshold: Number.NaN,
    });
    expect(nan.threshold).toBe(8);
  });

  it("a guest cannot name someone else as the instructor on a proposal", async () => {
    const provider = createMockDataProvider(null);
    const board = await provider.proposeInterestBoard({
      title: "Intro to leatherwork",
      summary: "Basic stitching and edge finishing.",
      contactName: "Pat",
      contactEmail: "pat@example.com",
      instructorHintUserId: "u-staff",
    });
    expect(board.instructorHintUserId).toBeNull();
    expect(board.status).toBe("pending");
  });

  it("staff can still set the threshold and instructor on a proposal", async () => {
    const provider = createMockDataProvider("u-staff");
    const board = await provider.proposeInterestBoard({
      title: "Intro to leatherwork",
      summary: "Basic stitching and edge finishing.",
      contactName: "Staff",
      contactEmail: "staff@example.com",
      proposedByUserId: "u-staff",
      threshold: 1,
      instructorHintUserId: "u-maya",
    });
    expect(board.threshold).toBe(1);
    expect(board.instructorHintUserId).toBe("u-maya");
  });
});

/** A live board that does not depend on fixture dates. Maya is a teacher. */
async function providerWithBoard(userId: string | null) {
  const teacher = createMockDataProvider("u-maya");
  const board = await teacher.proposeInterestBoard({
    title: "Open board for signup tests",
    summary: "Published straight away by a teacher.",
    contactName: "Maya",
    contactEmail: "maya.chen@example.com",
    proposedByUserId: "u-maya",
  });
  expect(board.status).toBe("open");
  await teacher.setCurrentUserId(userId);
  return { provider: teacher, boardId: board.id };
}

describe("interest signup", () => {
  it("does not reveal whether an email is already on the list", async () => {
    const { provider, boardId } = await providerWithBoard(null);
    const first = await provider.joinInterestBoard({
      boardId,
      email: "victim@example.com",
      displayName: "Victim Real Name",
    });
    const probe = await provider.joinInterestBoard({
      boardId,
      email: "victim@example.com",
      displayName: "Probe",
    });
    expect(probe.id).not.toBe(first.id);
    expect(probe.displayName).toBe("Probe");
    const after = await provider.getInterestBoard(boardId);
    const repeat = await provider.joinInterestBoard({
      boardId,
      email: "victim@example.com",
      displayName: "Probe",
    });
    expect(repeat.id).not.toBe(probe.id);
    const final = await provider.getInterestBoard(boardId);
    expect(final?.interestCount).toBe(after?.interestCount);
  });

  it("returns a member their own signup when they join twice", async () => {
    const { provider, boardId } = await providerWithBoard("u-drew");
    const input = {
      boardId,
      userId: "u-drew",
      email: "drew@example.com",
      displayName: "Drew",
    };
    const first = await provider.joinInterestBoard(input);
    const second = await provider.joinInterestBoard(input);
    expect(second.id).toBe(first.id);
  });

  it("rejects an oversized name or a bad email", async () => {
    const { provider, boardId } = await providerWithBoard(null);
    await expect(
      provider.joinInterestBoard({
        boardId,
        email: "pat@example.com",
        displayName: LONG,
      }),
    ).rejects.toThrow(/too long/i);
    await expect(
      provider.joinInterestBoard({
        boardId,
        email: "nope",
        displayName: "Pat",
      }),
    ).rejects.toThrow(/valid email/i);
  });
});

describe("bounty contact details", () => {
  it("hides requester emails from a signed-in account that has no claim on them", async () => {
    const provider = createMockDataProvider("u-drew");
    const bounties = await provider.listBounties();
    const open = bounties.find((b) => b.id === "bounty-open-sign")!;
    expect(open.requesterEmail).toBeUndefined();
    const one = await provider.getBounty("bounty-open-sign");
    expect(one?.requesterEmail).toBeUndefined();
  });

  it("shows the email to staff, and to the member who claimed the bounty", async () => {
    const staff = createMockDataProvider("u-staff");
    expect((await staff.getBounty("bounty-open-sign"))?.requesterEmail).toBe(
      "priya@burienbrew.example",
    );
    const claimed = (await staff.listBounties()).find(
      (b) => b.status === "claimed" && b.claimedByUserId,
    )!;
    const claimer = createMockDataProvider(claimed.claimedByUserId!);
    expect((await claimer.getBounty(claimed.id))?.requesterEmail).toBe(
      claimed.requesterEmail,
    );
  });

  it("shows a requester their own email", async () => {
    const provider = createMockDataProvider("u-drew");
    const mine = await provider.submitBountyRequest({
      title: "Shelf brackets",
      description: "Four steel brackets for a garage shelf.",
      requesterName: "Drew",
      requesterEmail: "drew@example.com",
      userId: "u-drew",
    });
    expect((await provider.getBounty(mine.id))?.requesterEmail).toBe(
      "drew@example.com",
    );
  });
});

describe("inventory edit permission", () => {
  it("a steward cannot edit another area's item by claiming it for their own area", async () => {
    // Maya stewards the woodshop. inv-prusa lives in the 3D printing area.
    const provider = createMockDataProvider("u-maya");
    await expect(
      provider.updateInventoryItem("u-maya", "inv-prusa", {
        areaId: "ia-woodshop",
        name: "Mine now",
      }),
    ).rejects.toThrow(/steward/i);
    await expect(
      provider.updateInventoryItem("u-maya", "inv-prusa", {
        areaId: null,
        name: "Mine now",
      }),
    ).rejects.toThrow(/steward/i);
  });

  it("a steward cannot push their own item into an area they do not steward", async () => {
    const provider = createMockDataProvider("u-maya");
    await expect(
      provider.updateInventoryItem("u-maya", "inv-sander", { areaId: "ia-fdm" }),
    ).rejects.toThrow(/steward/i);
  });

  it("a steward can still edit an item in their own area", async () => {
    const provider = createMockDataProvider("u-maya");
    const updated = await provider.updateInventoryItem("u-maya", "inv-sander", {
      name: "Orbital sander (5 in)",
    });
    expect(updated.name).toBe("Orbital sander (5 in)");
  });
});

describe("waiver signing", () => {
  it("needs a typed name", async () => {
    const provider = createMockDataProvider("u-avery");
    await expect(
      provider.signWaiver({
        userId: "u-avery",
        fullNameTyped: "   ",
        agreed: true,
        ip: "203.0.113.9",
        userAgent: "test",
      } as never),
    ).rejects.toThrow(/name/i);
  });
});

describe("machine availability", () => {
  it("refuses a date range far beyond the reservation horizon", async () => {
    const provider = createMockDataProvider("u-maya");
    const machines = await provider.listMachines();
    await expect(
      provider.getMachineAvailability(machines[0]!.id, "0001-01-01", "9999-12-31"),
    ).rejects.toThrow(/range/i);
    await expect(
      provider.getMachineAvailability(machines[0]!.id, "not-a-date", "2026-11-20"),
    ).rejects.toThrow(/range|date/i);
  });
});
