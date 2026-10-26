/**
 * Shared publish-readiness + quiz grading helpers for learning modules.
 */
import type {
  LearningModule,
  Lesson,
  LessonVideo,
  PublishBlocker,
  Question,
} from "@/lib/data/types";
import type { ModulePublishReadiness } from "@/lib/data/provider";

export function computePublishReadiness(input: {
  module: LearningModule;
  lessons: Lesson[];
  videos: LessonVideo[];
  questions: Question[];
}): ModulePublishReadiness {
  const { module, lessons, videos, questions } = input;
  const answerPendingIds = questions
    .filter((q) => q.active !== false && q.answerPending)
    .map((q) => q.id);
  const unreviewedPrimary = videos
    .filter((v) => v.role === "primary" && !v.staffReviewed)
    .map((v) => v.id);
  const gapLessonIds = lessons.filter((l) => l.gap).map((l) => l.id);
  const equipmentUnconfirmed = module.equipmentStatus !== "confirmed";

  return {
    canPublish:
      answerPendingIds.length === 0 &&
      unreviewedPrimary.length === 0 &&
      !equipmentUnconfirmed &&
      gapLessonIds.length === 0,
    answerPendingCount: answerPendingIds.length,
    unreviewedPrimaryVideoCount: unreviewedPrimary.length,
    equipmentUnconfirmed,
    gapLessonCount: gapLessonIds.length,
    answerPendingQuestionIds: answerPendingIds,
    unreviewedPrimaryVideoIds: unreviewedPrimary,
    gapLessonIds,
  };
}

export function publishBlockersFromReadiness(
  readiness: ModulePublishReadiness,
): PublishBlocker[] {
  const reasons: PublishBlocker[] = [];
  if (readiness.answerPendingCount > 0) reasons.push("answerPending");
  if (readiness.unreviewedPrimaryVideoCount > 0) {
    reasons.push("primaryVideoUnreviewed");
  }
  if (readiness.equipmentUnconfirmed) reasons.push("equipmentUnconfirmed");
  if (readiness.gapLessonCount > 0) reasons.push("gapLesson");
  return reasons;
}

function answersMatch(
  answer: number | number[] | null | undefined,
  indexes: number[],
): boolean {
  if (indexes.length <= 1) {
    const expected = indexes[0];
    if (Array.isArray(answer)) {
      return answer.length === 1 && answer[0] === expected;
    }
    return answer === expected;
  }
  if (!Array.isArray(answer) || answer.length !== indexes.length) {
    return false;
  }
  const a = [...answer].sort((x, y) => x - y);
  const b = [...indexes].sort((x, y) => x - y);
  return a.every((v, i) => v === b[i]);
}

export function gradeQuizAttempt(input: {
  questions: Question[];
  answers: (number | number[] | null)[];
  passThresholdPercent: number;
  requireSafetyCriticalAll: boolean;
}): {
  scorePct: number;
  thresholdMet: boolean;
  safetyCriticalMissed: Question[];
  passed: boolean;
} {
  const { questions, answers, passThresholdPercent, requireSafetyCriticalAll } =
    input;
  let correct = 0;
  const safetyCriticalMissed: Question[] = [];

  questions.forEach((q, i) => {
    const answer = answers[i] ?? null;
    const indexes =
      q.correctIndexes && q.correctIndexes.length > 0
        ? q.correctIndexes
        : [q.correctIndex];
    const ok = answersMatch(answer, indexes);
    if (ok) correct += 1;
    else if (q.safetyCritical) safetyCriticalMissed.push(q);
  });

  const scorePct =
    questions.length === 0
      ? 0
      : Math.round((correct / questions.length) * 100);
  const thresholdMet = scorePct >= passThresholdPercent;
  const safetyOk =
    !requireSafetyCriticalAll || safetyCriticalMissed.length === 0;
  return {
    scorePct,
    thresholdMet,
    safetyCriticalMissed,
    passed: thresholdMet && safetyOk,
  };
}
