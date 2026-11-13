import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockDataProvider, createMockDataProvider } from "./mock-provider";

const MODULE = "mod-shop-orientation";

/** Publish the module and get u-drew to the point where the quiz unlocks. */
async function readyProvider(): Promise<MockDataProvider> {
  const provider = createMockDataProvider("u-admin");
  const readiness = await provider.getModulePublishReadiness(MODULE);
  for (const id of readiness.unreviewedPrimaryVideoIds) {
    await provider.adminSetVideoReviewed(id, true);
  }
  const bank = await provider.adminListQuestions(MODULE);
  for (const qid of readiness.answerPendingQuestionIds) {
    const q = bank.find((x) => x.id === qid);
    if (!q) continue;
    await provider.adminUpsertQuestion({
      ...q,
      choices: ["Call 911, then staff", "Find staff first", "Wait", "Tweet"],
      correctIndex: 0,
      answerPending: false,
    });
  }
  const published = await provider.adminPublishModule(MODULE, true);
  expect(published.ok).toBe(true);
  const detail = await provider.getModule("shop-orientation");
  for (const lesson of detail?.lessons ?? []) {
    for (const video of lesson.videos) {
      if (video.role === "primary") await provider.markVideoWatched(video.id, "u-drew");
    }
  }
  return provider;
}

/** A fresh provider over the same data, the way each live request gets one. */
function nextRequest(from: MockDataProvider, userId: string): MockDataProvider {
  return new MockDataProvider(from.getState(), userId);
}

function answersFor(count: number) {
  return Array.from({ length: count }, () => 0);
}

describe("quiz attempt token", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "test-secret-for-quiz-tokens");
  });

  it("a quiz started in one request can be submitted in the next", async () => {
    const first = await readyProvider();
    const start = nextRequest(first, "u-drew");
    const quiz = await start.startQuiz(MODULE, "u-drew");

    const submit = nextRequest(start, "u-drew");
    const result = await submit.submitQuiz({
      attemptToken: quiz.attemptToken,
      userId: "u-drew",
      moduleId: MODULE,
      questionIds: quiz.questions.map((q) => q.id),
      answers: answersFor(quiz.questions.length),
    });
    expect(result.attempt.userId).toBe("u-drew");
    expect(result.attempt.questionIds).toEqual(quiz.questions.map((q) => q.id));
  });

  it("rejects the same token a second time", async () => {
    const provider = nextRequest(await readyProvider(), "u-drew");
    const quiz = await provider.startQuiz(MODULE, "u-drew");
    const input = {
      attemptToken: quiz.attemptToken,
      userId: "u-drew",
      moduleId: MODULE,
      questionIds: quiz.questions.map((q) => q.id),
      answers: answersFor(quiz.questions.length),
    };
    await provider.submitQuiz(input);
    const later = nextRequest(provider, "u-drew");
    await expect(later.submitQuiz(input)).rejects.toThrow(/already submitted/i);
  });

  it("rejects a token that was edited", async () => {
    const provider = nextRequest(await readyProvider(), "u-drew");
    const quiz = await provider.startQuiz(MODULE, "u-drew");
    const [head, body, sig] = quiz.attemptToken.split(".");
    const forged = `${head}.${body}x.${sig}`;
    await expect(
      provider.submitQuiz({
        attemptToken: forged,
        userId: "u-drew",
        moduleId: MODULE,
        questionIds: quiz.questions.map((q) => q.id),
        answers: answersFor(quiz.questions.length),
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects a token signed with a different secret", async () => {
    const provider = nextRequest(await readyProvider(), "u-drew");
    const quiz = await provider.startQuiz(MODULE, "u-drew");
    vi.stubEnv("AUTH_SECRET", "some-other-secret");
    const other = nextRequest(provider, "u-drew");
    await expect(
      other.submitQuiz({
        attemptToken: quiz.attemptToken,
        userId: "u-drew",
        moduleId: MODULE,
        questionIds: quiz.questions.map((q) => q.id),
        answers: answersFor(quiz.questions.length),
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("will not let another member submit someone's attempt", async () => {
    const provider = nextRequest(await readyProvider(), "u-drew");
    const quiz = await provider.startQuiz(MODULE, "u-drew");
    await expect(
      provider.submitQuiz({
        attemptToken: quiz.attemptToken,
        userId: "u-maya",
        moduleId: MODULE,
        questionIds: quiz.questions.map((q) => q.id),
        answers: answersFor(quiz.questions.length),
      }),
    ).rejects.toThrow(/mismatch/i);
  });

  it("enforces the attempt limit at submit, not only at start", async () => {
    const provider = nextRequest(await readyProvider(), "u-drew");
    const settings = await provider.getSettings();
    const limit = settings.quizAttemptLimit;
    const started = [];
    for (let i = 0; i < limit + 1; i++) {
      started.push(await provider.startQuiz(MODULE, "u-drew"));
      // Distinct start times, as separate requests would have.
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const submit = (quiz: (typeof started)[number]) =>
      provider.submitQuiz({
        attemptToken: quiz.attemptToken,
        userId: "u-drew",
        moduleId: MODULE,
        questionIds: quiz.questions.map((q) => q.id),
        answers: answersFor(quiz.questions.length).map(() => 3),
      });
    for (let i = 0; i < limit; i++) await submit(started[i]!);
    await expect(submit(started[limit]!)).rejects.toThrow(/attempt limit/i);
  });

  it("does not hand back correct answers for missed safety questions", async () => {
    const provider = nextRequest(await readyProvider(), "u-drew");
    const quiz = await provider.startQuiz(MODULE, "u-drew");
    const result = await provider.submitQuiz({
      attemptToken: quiz.attemptToken,
      userId: "u-drew",
      moduleId: MODULE,
      questionIds: quiz.questions.map((q) => q.id),
      answers: answersFor(quiz.questions.length).map(() => 3),
    });
    for (const missed of result.safetyCriticalMissed) {
      expect(missed).not.toHaveProperty("correctIndex");
      expect(missed).not.toHaveProperty("correctIndexes");
    }
  });
});
