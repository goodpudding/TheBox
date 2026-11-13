import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import {
  canProposeInterestBoard,
  canPublishInterestBoard,
} from "./class-interest";

describe("class interest boards", () => {
  it("lets teachers publish immediately and members stay pending", async () => {
    const provider = createMockDataProvider("u-maya");
    const maya = await provider.getMember("u-maya");
    expect(maya?.isTeacher).toBe(true);
    expect(canPublishInterestBoard(maya)).toBe(true);

    const teacherBoard = await provider.proposeInterestBoard({
      title: "Teacher live board",
      summary: "Published by teacher",
      contactName: maya!.displayName,
      contactEmail: maya!.email,
      proposedByUserId: maya!.id,
    });
    expect(teacherBoard.status).toBe("open");
    expect(teacherBoard.closesAt).toBeTruthy();

    const providerJordan = createMockDataProvider("u-jordan");
    const jordan = await providerJordan.getMember("u-jordan");
    expect(jordan?.isTeacher).toBe(false);
    expect(canProposeInterestBoard(jordan)).toBe(true);
    expect(canPublishInterestBoard(jordan)).toBe(false);

    const pending = await providerJordan.proposeInterestBoard({
      title: "Member idea",
      summary: "Needs review",
      contactName: jordan!.displayName,
      contactEmail: jordan!.email,
      proposedByUserId: jordan!.id,
    });
    expect(pending.status).toBe("pending");
  });

  it("moves open boards to ready at threshold and expires on sweep", async () => {
    const provider = createMockDataProvider("u-staff");
    const board = await provider.proposeInterestBoard({
      title: "Threshold test",
      summary: "Hit six",
      contactName: "Sam",
      contactEmail: "staff@example.com",
      proposedByUserId: "u-staff",
      threshold: 2,
    });
    expect(board.status).toBe("open");

    await provider.joinInterestBoard({
      boardId: board.id,
      userId: "u-maya",
      email: "maya.chen@example.com",
      displayName: "Maya Chen",
    });
    await provider.joinInterestBoard({
      boardId: board.id,
      email: "guest@example.com",
      displayName: "Guest",
    });
    const ready = await provider.getInterestBoard(board.id);
    expect(ready?.status).toBe("ready");
    expect(ready?.interestCount).toBe(2);
  });

  it("resuggests expired boards for the proposer", async () => {
    const provider = createMockDataProvider("u-jordan");
    const next = await provider.resuggestInterestBoard(
      "interest-cnc-expired",
      "u-jordan",
    );
    expect(next.resuggestedFromId).toBe("interest-cnc-expired");
    expect(next.status).toBe("pending");
  });

  it("hides contact and review fields from other viewers", async () => {
    const provider = createMockDataProvider("u-jordan");
    const pending = await provider.proposeInterestBoard({
      title: "Member idea",
      summary: "Needs review",
      contactName: "Jordan",
      contactEmail: "jordan@example.com",
      proposedByUserId: "u-jordan",
    });
    const mine = await provider.getInterestBoard(pending.id);
    expect(mine?.contactEmail).toBe("jordan@example.com");
    expect(
      (await provider.listInterestBoards()).map((b) => b.id),
    ).toContain(pending.id);

    await provider.setCurrentUserId("u-maya");
    expect(await provider.getInterestBoard(pending.id)).toBeNull();
    const listed = await provider.listInterestBoards();
    expect(listed.map((b) => b.id)).not.toContain(pending.id);
    for (const board of listed) {
      if (board.proposedByUserId === "u-maya") continue;
      expect(board).not.toHaveProperty("contactEmail");
      expect(board).not.toHaveProperty("staffNotes");
    }

    await provider.setCurrentUserId(null);
    const open = (await provider.listInterestBoards({ publicOnly: true }))[0];
    expect(open).toBeTruthy();
    expect(open).not.toHaveProperty("contactName");
    expect(open).not.toHaveProperty("reviewedById");

    await provider.setCurrentUserId("u-admin");
    const staffView = await provider.getInterestBoard(pending.id);
    expect(staffView?.contactEmail).toBe("jordan@example.com");
  });

  it("strips bounty requester details for anonymous viewers", async () => {
    const provider = createMockDataProvider(null);
    const [bounty] = await provider.listBounties();
    expect(bounty).toBeTruthy();
    expect(bounty).not.toHaveProperty("requesterEmail");
    expect(bounty).not.toHaveProperty("userId");
    // A signed-in account with no stake in the request does not get them either.
    await provider.setCurrentUserId("u-drew");
    expect((await provider.listBounties())[0]).not.toHaveProperty("requesterEmail");
    await provider.setCurrentUserId("u-staff");
    expect((await provider.listBounties())[0]).toHaveProperty("requesterEmail");
  });

  it("hides unpublished classes from non-staff", async () => {
    const provider = createMockDataProvider("u-admin");
    const session = (await provider.listClasses({ upcomingOnly: true }))[0]!;
    await provider.adminUpsertClass({ ...session, published: false });
    expect(await provider.getClass(session.id)).not.toBeNull();
    await provider.setCurrentUserId("u-maya");
    expect(await provider.getClass(session.id)).toBeNull();
    await provider.setCurrentUserId(null);
    expect(await provider.getClass(session.id)).toBeNull();
  });

  it("gates booking during priority window", async () => {
    const provider = createMockDataProvider("u-admin");
    const classes = await provider.listClasses({ upcomingOnly: true });
    const session = classes[0];
    expect(session).toBeTruthy();

    await provider.adminLinkInterestBoardToClass(
      "interest-embroidery-intro",
      session.id,
      "u-admin",
    );

    await expect(provider.book(session.id, "u-riley")).rejects.toThrow(
      /priority window/i,
    );

    const mayaBook = await provider.book(session.id, "u-maya");
    expect(["booked", "awaiting_payment", "waitlisted"]).toContain(
      mayaBook.status,
    );
  });
});
