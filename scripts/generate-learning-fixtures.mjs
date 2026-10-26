/**
 * Expand learning-videos.json + learning-questions.json into fixture files.
 *
 * Usage: node scripts/generate-learning-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mock = path.join(root, "data/mock");
const NOW = "2026-09-06T12:00:00-07:00";

const videosSrc = JSON.parse(
  fs.readFileSync(path.join(mock, "learning-videos.json"), "utf8"),
);
const questionsSrc = JSON.parse(
  fs.readFileSync(path.join(mock, "learning-questions.json"), "utf8"),
);

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function normalizeEquipmentStatus(raw) {
  if (!raw) return "confirmed";
  if (String(raw).startsWith("confirmed")) return "confirmed";
  return "unconfirmed";
}

/** Minutes from video runtimes when known; 8 min placeholder per unknown video + 2 min reading. */
function estimateLessonMinutes(les, gap) {
  if (gap) return 0;
  const vids = les.videos ?? [];
  if (vids.length === 0) return 8; // text-only lesson
  let seconds = 0;
  let unknown = 0;
  for (const v of vids) {
    if (typeof v.durationSeconds === "number" && v.durationSeconds > 0) {
      seconds += v.durationSeconds;
    } else {
      unknown += 1;
    }
  }
  seconds += unknown * 8 * 60; // placeholder until staff fills durationSeconds
  const readingPadMinutes = 2;
  return Math.max(1, Math.round(seconds / 60) + readingPadMinutes);
}

const modules = [];
const lessons = [];
const lessonVideos = [];
const questions = [];
const youtubeToVideoId = new Map();

let videoSeq = 0;

for (const [mi, mod] of videosSrc.modules.entries()) {
  const equipmentStatus = normalizeEquipmentStatus(mod.equipmentStatus);
  modules.push({
    id: mod.id,
    slug: mod.slug,
    title: mod.title,
    summary: mod.summary ?? `${mod.title} knowledge path for The Box.`,
    certificationId: mod.certificationId,
    knowledgeOnly: Boolean(mod.knowledgeOnly),
    published: Boolean(mod.published),
    equipmentStatus,
    passThresholdPercent: 80,
    attemptLimit: 3,
    sortOrder: mi + 1,
    createdAt: NOW,
    updatedAt: NOW,
  });

  for (const [li, les] of (mod.lessons ?? []).entries()) {
    const lessonId = les.id;
    // Text-only gate lessons (e.g. in-house resin safety) set gap:false explicitly.
    const gap =
      les.gap === false
        ? false
        : Boolean(les.gap) ||
          (Array.isArray(les.videos) && les.videos.length === 0 && les.gate);
    lessons.push({
      id: lessonId,
      moduleId: mod.id,
      slug: slugify(les.title) || `${mod.slug}-${li + 1}`,
      title: les.title,
      contentSlug: les.contentSlug || "lesson-generic",
      sortOrder: les.order ?? li + 1,
      estimatedMinutes: estimateLessonMinutes(les, gap),
      gap,
      createdAt: NOW,
      updatedAt: NOW,
    });

    for (const [vi, vid] of (les.videos ?? []).entries()) {
      videoSeq += 1;
      const id = `vid-${mod.slug}-${String(vi + 1).padStart(2, "0")}-${vid.youtubeId.slice(0, 6)}`;
      youtubeToVideoId.set(vid.youtubeId, id);
      lessonVideos.push({
        id,
        lessonId,
        order: vi + 1,
        provider: "youtube",
        youtubeId: vid.youtubeId,
        url: vid.url,
        title: vid.title,
        channel: vid.channel,
        role: vid.role || "primary",
        condition: vid.condition ?? null,
        durationSeconds: vid.durationSeconds ?? null,
        verifiedAt: vid.verifiedAt
          ? `${vid.verifiedAt}T12:00:00-07:00`
          : null,
        staffReviewed: Boolean(vid.staffReviewed),
        notes: vid.notes ?? null,
        createdAt: NOW,
        updatedAt: NOW,
      });
    }
  }
}

const moduleIdByBank = new Map(
  questionsSrc.banks.map((b) => [b.moduleId, b.moduleId]),
);

for (const bank of questionsSrc.banks) {
  const moduleId = bank.moduleId;
  if (!modules.some((m) => m.id === moduleId)) {
    console.warn("Skipping bank for unknown module", moduleId);
    continue;
  }
  for (const q of bank.questions) {
    const correct = Array.isArray(q.correct) ? q.correct : [q.correct ?? 0];
    const choices = q.options ?? q.choices ?? [];
    questions.push({
      id: q.id,
      moduleId,
      prompt: q.prompt,
      choices,
      correctIndex: correct[0] ?? 0,
      correctIndexes: correct,
      explanation: q.explanation ?? "",
      active: true,
      safetyCritical: Boolean(q.safetyCritical),
      source: q.source === "shop-policy" ? "shop-policy" : "video",
      sourceVideoId: q.sourceVideoId
        ? youtubeToVideoId.get(q.sourceVideoId) ?? null
        : null,
      verifyAgainstVideo: Boolean(q.verifyAgainstVideo),
      answerPending: Boolean(q.answerPending),
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
}

// Quiz attempt fixtures covering pass / threshold fail / safety fail / attempt limit
const quizAttempts = [
  {
    id: "qa-orient-maya-pass",
    userId: "u-maya",
    moduleId: "mod-shop-orientation",
    questionIds: ["q-so-01", "q-so-02", "q-so-03", "q-so-04", "q-so-05"],
    answers: [0, 0, 0, 0, 0],
    scorePercent: 100,
    passed: true,
    thresholdMet: true,
    safetyCriticalMissedIds: [],
    startedAt: "2026-09-01T10:00:00-07:00",
    submittedAt: "2026-09-01T10:12:00-07:00",
    createdAt: "2026-09-01T10:12:00-07:00",
    updatedAt: "2026-09-01T10:12:00-07:00",
  },
  {
    id: "qa-fdm-drew-threshold-fail",
    userId: "u-drew",
    moduleId: "mod-3d-printing",
    questionIds: [
      "q-3d-01",
      "q-3d-02",
      "q-3d-03",
      "q-3d-04",
      "q-3d-05",
      "q-3d-06",
      "q-3d-07",
      "q-3d-08",
      "q-3d-09",
      "q-3d-10",
    ],
    answers: [1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    scorePercent: 30,
    passed: false,
    thresholdMet: false,
    safetyCriticalMissedIds: [],
    startedAt: "2026-09-02T10:00:00-07:00",
    submittedAt: "2026-09-02T10:15:00-07:00",
    createdAt: "2026-09-02T10:15:00-07:00",
    updatedAt: "2026-09-02T10:15:00-07:00",
  },
  {
    id: "qa-tablesaw-jordan-safety-fail",
    userId: "u-jordan",
    moduleId: "mod-table-saw",
    questionIds: [
      "q-ts-01",
      "q-ts-02",
      "q-ts-03",
      "q-ts-04",
      "q-ts-05",
      "q-ts-06",
      "q-ts-07",
      "q-ts-08",
      "q-ts-09",
      "q-ts-10",
    ],
    // Miss kickback (safety) but get most others — illustrates 90%+ with safety miss
    answers: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    scorePercent: 90,
    passed: false,
    thresholdMet: true,
    safetyCriticalMissedIds: ["q-ts-01"],
    startedAt: "2026-09-03T10:00:00-07:00",
    submittedAt: "2026-09-03T10:20:00-07:00",
    createdAt: "2026-09-03T10:20:00-07:00",
    updatedAt: "2026-09-03T10:20:00-07:00",
  },
  {
    id: "qa-laser-kai-1",
    userId: "u-kai",
    moduleId: "mod-laser-cutter",
    questionIds: ["q-lc-01", "q-lc-02", "q-lc-03"],
    answers: [1, 1, 1],
    scorePercent: 0,
    passed: false,
    thresholdMet: false,
    safetyCriticalMissedIds: ["q-lc-01", "q-lc-02", "q-lc-03"],
    startedAt: "2026-09-04T09:00:00-07:00",
    submittedAt: "2026-09-04T09:10:00-07:00",
    createdAt: "2026-09-04T09:10:00-07:00",
    updatedAt: "2026-09-04T09:10:00-07:00",
  },
  {
    id: "qa-laser-kai-2",
    userId: "u-kai",
    moduleId: "mod-laser-cutter",
    questionIds: ["q-lc-01", "q-lc-02", "q-lc-03"],
    answers: [1, 1, 1],
    scorePercent: 0,
    passed: false,
    thresholdMet: false,
    safetyCriticalMissedIds: ["q-lc-01", "q-lc-02", "q-lc-03"],
    startedAt: "2026-09-04T11:00:00-07:00",
    submittedAt: "2026-09-04T11:10:00-07:00",
    createdAt: "2026-09-04T11:10:00-07:00",
    updatedAt: "2026-09-04T11:10:00-07:00",
  },
  {
    id: "qa-laser-kai-3",
    userId: "u-kai",
    moduleId: "mod-laser-cutter",
    questionIds: ["q-lc-01", "q-lc-02", "q-lc-03"],
    answers: [1, 1, 1],
    scorePercent: 0,
    passed: false,
    thresholdMet: false,
    safetyCriticalMissedIds: ["q-lc-01", "q-lc-02", "q-lc-03"],
    startedAt: "2026-09-04T14:00:00-07:00",
    submittedAt: "2026-09-04T14:10:00-07:00",
    createdAt: "2026-09-04T14:10:00-07:00",
    updatedAt: "2026-09-04T14:10:00-07:00",
  },
];

fs.writeFileSync(
  path.join(mock, "learning-modules.json"),
  JSON.stringify(modules, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(mock, "lessons.json"),
  JSON.stringify(lessons, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(mock, "lesson-videos.json"),
  JSON.stringify(lessonVideos, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(mock, "questions.json"),
  JSON.stringify(questions, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(mock, "quiz-attempts.json"),
  JSON.stringify(quizAttempts, null, 2) + "\n",
);
fs.writeFileSync(path.join(mock, "video-watches.json"), "[]\n");

console.log({
  modules: modules.length,
  lessons: lessons.length,
  videos: lessonVideos.length,
  questions: questions.length,
  answerPending: questions.filter((q) => q.answerPending).length,
  safetyCritical: questions.filter((q) => q.safetyCritical).length,
  gapLessons: lessons.filter((l) => l.gap).length,
});
