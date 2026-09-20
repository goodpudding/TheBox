import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { canClaimBounty } from "./bounties";

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
});
