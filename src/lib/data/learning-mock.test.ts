import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

describe("learning publish + quiz (mock)", () => {
  it("refuses publish while readiness blockers remain", async () => {
    const provider = createMockDataProvider("u-admin");
    const result = await provider.adminPublishModule(
      "mod-shop-orientation",
      true,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.readiness.canPublish).toBe(false);
    }
  });

  it("unlocks quiz only after primary videos are watched", async () => {
    const provider = createMockDataProvider("u-admin");
    const readiness = await provider.getModulePublishReadiness(
      "mod-shop-orientation",
    );
    for (const id of readiness.unreviewedPrimaryVideoIds) {
      await provider.adminSetVideoReviewed(id, true);
    }
    for (const qid of readiness.answerPendingQuestionIds) {
      const bank = await provider.adminListQuestions("mod-shop-orientation");
      const q = bank.find((x) => x.id === qid);
      if (!q) continue;
      await provider.adminUpsertQuestion({
        ...q,
        moduleId: q.moduleId,
        prompt: q.prompt,
        choices: ["Call 911, then staff", "Find staff first", "Wait", "Tweet"],
        correctIndex: 0,
        answerPending: false,
      });
    }
    const published = await provider.adminPublishModule(
      "mod-shop-orientation",
      true,
    );
    expect(published.ok).toBe(true);

    await provider.setCurrentUserId("u-drew");
    await expect(
      provider.startQuiz("mod-shop-orientation", "u-drew"),
    ).rejects.toThrow(/primary|watch|video/i);

    const detail = await provider.getModule("shop-orientation");
    expect(detail).not.toBeNull();
    const primaryIds =
      detail?.lessons.flatMap((l) =>
        l.videos.filter((v) => v.role === "primary").map((v) => v.id),
      ) ?? [];
    for (const vid of primaryIds) {
      await provider.markVideoWatched(vid, "u-drew");
    }
    const quiz = await provider.startQuiz("mod-shop-orientation", "u-drew");
    expect(quiz.questions.length).toBeGreaterThan(0);
  });

  it("lists pending checkoffs and lets tool champions check off their machines", async () => {
    const provider = createMockDataProvider("u-staff");
    const staffQueue = await provider.listPendingCheckoffs("u-staff");
    expect(staffQueue.length).toBeGreaterThan(0);
    expect(
      staffQueue.every((r) => r.canCheckoff && r.certificationId !== "cert-shop-orientation"),
    ).toBe(true);

    const laser = staffQueue.find((r) => r.certificationId === "cert-laser-cutter");
    expect(laser).toBeDefined();

    // Maya champions sewing only — should not see laser/3d pending rows
    const mayaQueue = await provider.listPendingCheckoffs("u-maya");
    expect(
      mayaQueue.every((r) =>
        r.machineIds.some((id) => id === "m-sewing-1" || id === "m-sewing-2"),
      ),
    ).toBe(true);

    // Staff can always record
    if (laser) {
      const uc = await provider.recordCheckoff({
        userId: laser.userId,
        certificationId: laser.certificationId,
        actorId: "u-staff",
      });
      expect(uc.status).toBe("certified");
    }
  });
});
