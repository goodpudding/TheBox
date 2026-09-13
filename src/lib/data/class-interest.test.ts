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
