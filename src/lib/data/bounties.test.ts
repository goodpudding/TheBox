import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { canClaimBounty, isDisplayBounty } from "./bounties";

describe("bounty board", () => {
  it("lets guests submit a request that members can see as open", async () => {
    const provider = createMockDataProvider(null);
    const created = await provider.submitBountyRequest({
      title: "Vinyl window decal",
      description: "Storefront name in two colors, about 36 inches wide.",
      requesterName: "Casey Guest",
      requesterEmail: "casey@shop.example",
      businessName: "Casey’s Shop",
    });
    expect(created.status).toBe("open");
    expect(created.claimedByUserId).toBeNull();

    const listed = await provider.listBounties();
    const found = listed.find((b) => b.id === created.id);
    expect(found?.status).toBe("open");
    expect(found?.title).toBe("Vinyl window decal");
  });

  it("lets an active member claim and blocks a second claim", async () => {
    const provider = createMockDataProvider("u-jordan");
    expect(canClaimBounty(await provider.getMember("u-jordan"))).toBe(true);

    const claimed = await provider.claimBounty("bounty-open-sign", "u-jordan");
    expect(claimed.status).toBe("claimed");
    expect(claimed.claimedByUserId).toBe("u-jordan");

    const view = await provider.getBounty("bounty-open-sign");
    expect(view?.claimedByDisplayName).toBe("Jordan Lee");

    await expect(
      provider.claimBounty("bounty-open-sign", "u-maya"),
    ).rejects.toThrow(/already claimed/i);
  });

  it("lets the claimer mark a bounty completed", async () => {
    const maya = createMockDataProvider("u-maya");
    const done = await maya.completeBounty("bounty-claimed-aprons", "u-maya");
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBeTruthy();
  });

  it("rejects claims from guests and lapsed members", async () => {
    const guest = createMockDataProvider(null);
    await expect(
      guest.claimBounty("bounty-open-hooks", "missing"),
    ).rejects.toThrow(/sign in/i);

    const lapsed = createMockDataProvider("u-alex");
    expect(canClaimBounty(await lapsed.getMember("u-alex"))).toBe(false);
    await expect(
      lapsed.claimBounty("bounty-open-hooks", "u-alex"),
    ).rejects.toThrow(/active membership/i);
  });

  it("puts open and recently claimed bounties on the lobby feed, not completed", async () => {
    const provider = createMockDataProvider(null);
    const feed = await provider.getDisplayFeed();
    const ids = feed.bounties.map((b) => b.id);
    expect(ids).toContain("bounty-open-sign");
    expect(ids).toContain("bounty-claimed-aprons");
    expect(ids).not.toContain("bounty-done-keychains");
    expect(feed.bounties.every((b) => b.status === "open" || b.status === "claimed")).toBe(
      true,
    );
    const claimed = feed.bounties.find((b) => b.id === "bounty-claimed-aprons");
    expect(claimed?.claimedByDisplayName).toBeTruthy();
    expect(
      JSON.stringify(feed.bounties).includes("@"),
    ).toBe(false);
  });

  it("keeps stale claimed bounties off the lobby TV", () => {
    expect(
      isDisplayBounty({
        status: "claimed",
        claimedAt: "2026-01-01T00:00:00.000Z",
      }, Date.parse("2026-09-20T00:00:00.000Z")),
    ).toBe(false);
    expect(
      isDisplayBounty({ status: "open" }, Date.parse("2026-09-20T00:00:00.000Z")),
    ).toBe(true);
  });
});
