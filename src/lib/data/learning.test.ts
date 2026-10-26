import { describe, expect, it } from "vitest";
import {
  computePublishReadiness,
  gradeQuizAttempt,
  publishBlockersFromReadiness,
} from "./learning";
import type {
  LearningModule,
  Lesson,
  LessonVideo,
  Question,
} from "./types";

const baseModule: LearningModule = {
  id: "mod-test",
  slug: "test",
  title: "Test",
  summary: "s",
  certificationId: "cert-shop-orientation",
  knowledgeOnly: true,
  published: false,
  equipmentStatus: "confirmed",
  passThresholdPercent: 80,
  attemptLimit: 3,
  sortOrder: 1,
  createdAt: "2026-09-07T00:00:00Z",
  updatedAt: "2026-09-07T00:00:00Z",
};

function q(partial: Partial<Question> & Pick<Question, "id" | "prompt">): Question {
  return {
    moduleId: "mod-test",
    choices: ["a", "b", "c", "d"],
    correctIndex: 0,
    correctIndexes: [0],
    active: true,
    safetyCritical: false,
    source: "video",
    verifyAgainstVideo: true,
    answerPending: false,
    createdAt: "2026-09-07T00:00:00Z",
    updatedAt: "2026-09-07T00:00:00Z",
    ...partial,
  };
}

describe("gradeQuizAttempt", () => {
  it("passes when threshold met and no safety misses", () => {
    const questions = [
      q({ id: "1", prompt: "p1", correctIndex: 0 }),
      q({ id: "2", prompt: "p2", correctIndex: 1, correctIndexes: [1] }),
      q({ id: "3", prompt: "p3", correctIndex: 2, correctIndexes: [2] }),
      q({
        id: "4",
        prompt: "safety",
        safetyCritical: true,
        correctIndex: 0,
      }),
      q({ id: "5", prompt: "p5", correctIndex: 0 }),
    ];
    const result = gradeQuizAttempt({
      questions,
      answers: [0, 1, 2, 0, 1],
      passThresholdPercent: 80,
      requireSafetyCriticalAll: true,
    });
    expect(result.scorePct).toBe(80);
    expect(result.thresholdMet).toBe(true);
    expect(result.safetyCriticalMissed).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it("fails when a safety-critical question is wrong even at 90%", () => {
    const questions = [
      q({ id: "1", prompt: "kickback", safetyCritical: true, correctIndex: 0 }),
      q({ id: "2", prompt: "p2", correctIndex: 0 }),
      q({ id: "3", prompt: "p3", correctIndex: 0 }),
      q({ id: "4", prompt: "p4", correctIndex: 0 }),
      q({ id: "5", prompt: "p5", correctIndex: 0 }),
      q({ id: "6", prompt: "p6", correctIndex: 0 }),
      q({ id: "7", prompt: "p7", correctIndex: 0 }),
      q({ id: "8", prompt: "p8", correctIndex: 0 }),
      q({ id: "9", prompt: "p9", correctIndex: 0 }),
      q({ id: "10", prompt: "p10", correctIndex: 0 }),
    ];
    const answers = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = gradeQuizAttempt({
      questions,
      answers,
      passThresholdPercent: 80,
      requireSafetyCriticalAll: true,
    });
    expect(result.scorePct).toBe(90);
    expect(result.thresholdMet).toBe(true);
    expect(result.safetyCriticalMissed.map((x) => x.id)).toEqual(["1"]);
    expect(result.passed).toBe(false);
  });

  it("grades multi-select by exact set match", () => {
    const questions = [
      q({
        id: "m1",
        prompt: "select all",
        correctIndexes: [0, 1, 3],
        correctIndex: 0,
        safetyCritical: true,
      }),
    ];
    expect(
      gradeQuizAttempt({
        questions,
        answers: [[0, 3, 1]],
        passThresholdPercent: 80,
        requireSafetyCriticalAll: true,
      }).passed,
    ).toBe(true);
    expect(
      gradeQuizAttempt({
        questions,
        answers: [[0, 1]],
        passThresholdPercent: 80,
        requireSafetyCriticalAll: true,
      }).passed,
    ).toBe(false);
  });
});

describe("computePublishReadiness", () => {
  it("blocks on answerPending, unreviewed primary, gap, and unconfirmed equipment", () => {
    const lessons: Lesson[] = [
      {
        id: "les-1",
        moduleId: "mod-test",
        slug: "a",
        title: "A",
        contentSlug: "a",
        sortOrder: 1,
        estimatedMinutes: 10,
        gap: true,
        createdAt: "2026-09-07T00:00:00Z",
        updatedAt: "2026-09-07T00:00:00Z",
      },
    ];
    const videos: LessonVideo[] = [
      {
        id: "vid-1",
        lessonId: "les-1",
        order: 1,
        provider: "youtube",
        youtubeId: "abc",
        url: "https://www.youtube.com/watch?v=abc",
        title: "t",
        channel: "c",
        role: "primary",
        staffReviewed: false,
        createdAt: "2026-09-07T00:00:00Z",
        updatedAt: "2026-09-07T00:00:00Z",
      },
    ];
    const questions = [
      q({ id: "qp", prompt: "fill", answerPending: true }),
    ];
    const readiness = computePublishReadiness({
      module: { ...baseModule, equipmentStatus: "unconfirmed" },
      lessons,
      videos,
      questions,
    });
    expect(readiness.canPublish).toBe(false);
    expect(publishBlockersFromReadiness(readiness).sort()).toEqual(
      [
        "answerPending",
        "equipmentUnconfirmed",
        "gapLesson",
        "primaryVideoUnreviewed",
      ].sort(),
    );
  });

  it("allows publish when all gates clear", () => {
    const readiness = computePublishReadiness({
      module: baseModule,
      lessons: [
        {
          id: "les-1",
          moduleId: "mod-test",
          slug: "a",
          title: "A",
          contentSlug: "a",
          sortOrder: 1,
          estimatedMinutes: 10,
          gap: false,
          createdAt: "2026-09-07T00:00:00Z",
          updatedAt: "2026-09-07T00:00:00Z",
        },
      ],
      videos: [
        {
          id: "vid-1",
          lessonId: "les-1",
          order: 1,
          provider: "youtube",
          youtubeId: "abc",
          url: "https://www.youtube.com/watch?v=abc",
          title: "t",
          channel: "c",
          role: "primary",
          staffReviewed: true,
          createdAt: "2026-09-07T00:00:00Z",
          updatedAt: "2026-09-07T00:00:00Z",
        },
      ],
      questions: [q({ id: "q1", prompt: "ok" })],
    });
    expect(readiness.canPublish).toBe(true);
    expect(publishBlockersFromReadiness(readiness)).toEqual([]);
  });
});
