import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { RPC_RULES } from "./rpc-policy";

const ADMIN = "u-admin";
const MODULE = "mod-shop-orientation";

async function moduleRow(
  provider: ReturnType<typeof createMockDataProvider>,
  id = MODULE,
) {
  const mod = (await provider.listModules()).find((m) => m.id === id);
  if (!mod) throw new Error(`No module ${id}`);
  return mod;
}

/** A small module staff built by hand: one lesson, no videos, ready to publish. */
async function freshModule(provider: ReturnType<typeof createMockDataProvider>) {
  const cert = (await provider.listCertifications())[0]!;
  const mod = await provider.adminUpsertModule({
    title: "Kiln basics",
    slug: "kiln-basics",
    certificationId: cert.id,
  });
  const lesson = await provider.adminUpsertLesson({
    moduleId: mod.id,
    title: "Loading the kiln",
    slug: "loading",
    contentSlug: "kiln-loading",
  });
  return { mod, lesson, cert };
}

describe("editing a module", () => {
  it("changes only what was sent and keeps its lessons and questions", async () => {
    const provider = createMockDataProvider(ADMIN);
    const before = await moduleRow(provider);
    const detailBefore = await provider.getModule(before.slug);
    const questionsBefore = await provider.adminListQuestions(MODULE);

    const saved = await provider.adminUpsertModule({
      id: MODULE,
      title: "Shop Orientation (2027)",
      slug: before.slug,
      certificationId: before.certificationId,
      passThresholdPercent: 90,
      // A form field left out arrives as undefined in the fixture UI.
      summary: undefined,
    });

    expect(saved.title).toBe("Shop Orientation (2027)");
    expect(saved.passThresholdPercent).toBe(90);
    expect(saved.summary).toBe(before.summary);
    expect(saved.attemptLimit).toBe(before.attemptLimit);
    expect(saved.sortOrder).toBe(before.sortOrder);
    expect(saved.published).toBe(before.published);
    const detailAfter = await provider.getModule(before.slug);
    expect(detailAfter?.lessons.map((l) => l.id)).toEqual(
      detailBefore?.lessons.map((l) => l.id),
    );
    expect((await provider.adminListQuestions(MODULE)).length).toBe(
      questionsBefore.length,
    );
  });

  it("saves the summary, attempt limit, order and certification", async () => {
    const provider = createMockDataProvider(ADMIN);
    const before = await moduleRow(provider);
    const otherCert = (await provider.listCertifications()).find(
      (c) => c.id !== before.certificationId,
    )!;
    const saved = await provider.adminUpsertModule({
      id: MODULE,
      title: before.title,
      slug: before.slug,
      certificationId: otherCert.id,
      summary: "What every member needs before using the shop.",
      attemptLimit: 5,
      sortOrder: 40,
      knowledgeOnly: false,
    });
    expect(saved).toMatchObject({
      certificationId: otherCert.id,
      summary: "What every member needs before using the shop.",
      attemptLimit: 5,
      sortOrder: 40,
      knowledgeOnly: false,
    });
  });

  it("refuses values that make no sense, in plain words", async () => {
    const provider = createMockDataProvider(ADMIN);
    const before = await moduleRow(provider);
    const base = {
      id: MODULE,
      title: before.title,
      slug: before.slug,
      certificationId: before.certificationId,
    };
    await expect(provider.adminUpsertModule({ ...base, title: "  " })).rejects.toThrow(
      "Give the module a title.",
    );
    await expect(
      provider.adminUpsertModule({ ...base, passThresholdPercent: 140 }),
    ).rejects.toThrow("The pass mark must be between 1 and 100 percent.");
    await expect(
      provider.adminUpsertModule({ ...base, attemptLimit: 0 }),
    ).rejects.toThrow("Members need at least 1 attempt.");
    await expect(
      provider.adminUpsertModule({ ...base, certificationId: "cert-nope" }),
    ).rejects.toThrow("Choose a certification for this module.");
    const other = (await provider.listModules()).find((m) => m.id !== MODULE)!;
    await expect(
      provider.adminUpsertModule({ ...base, slug: other.slug }),
    ).rejects.toThrow(`Another module already uses the address "${other.slug}".`);
  });

  it("lets staff confirm the equipment, which unblocks publishing", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod } = await freshModule(provider);
    const base = { id: mod.id, title: mod.title, slug: mod.slug, certificationId: mod.certificationId };

    await provider.adminUpsertModule({ ...base, equipmentStatus: "unconfirmed" });
    expect((await provider.getModulePublishReadiness(mod.id)).equipmentUnconfirmed).toBe(true);
    const blocked = await provider.adminPublishModule(mod.id, true);
    expect(blocked.ok).toBe(false);

    await provider.adminUpsertModule({ ...base, equipmentStatus: "confirmed" });
    expect((await provider.getModulePublishReadiness(mod.id)).canPublish).toBe(true);
    expect((await provider.adminPublishModule(mod.id, true)).ok).toBe(true);
  });

  it("will not mark the equipment unconfirmed while members can open the module", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod } = await freshModule(provider);
    await provider.adminPublishModule(mod.id, true);
    await expect(
      provider.adminUpsertModule({
        id: mod.id,
        title: mod.title,
        slug: mod.slug,
        certificationId: mod.certificationId,
        equipmentStatus: "unconfirmed",
      }),
    ).rejects.toThrow("Unpublish the module before marking its equipment as not confirmed.");
  });
});

describe("the publish guard on create and edit", () => {
  it("does not let Publish now on the create form skip the guard", async () => {
    const provider = createMockDataProvider(ADMIN);
    const cert = (await provider.listCertifications())[0]!;
    const before = (await provider.listModules()).length;
    await expect(
      provider.adminUpsertModule({
        title: "Embroidery",
        slug: "embroidery-two",
        certificationId: cert.id,
        equipmentStatus: "unconfirmed",
        published: true,
      }),
    ).rejects.toThrow(/cannot be published yet/i);
    expect((await provider.listModules()).length).toBe(before);
  });

  it("does not let an edit publish a module that still has blockers", async () => {
    const provider = createMockDataProvider(ADMIN);
    const before = await moduleRow(provider);
    expect((await provider.getModulePublishReadiness(MODULE)).canPublish).toBe(false);
    await expect(
      provider.adminUpsertModule({
        id: MODULE,
        title: before.title,
        slug: before.slug,
        certificationId: before.certificationId,
        published: true,
      }),
    ).rejects.toThrow(/cannot be published yet/i);
    expect((await moduleRow(provider)).published).toBe(false);
  });

  it("publishes on create when nothing blocks it", async () => {
    const provider = createMockDataProvider(ADMIN);
    const cert = (await provider.listCertifications())[0]!;
    const mod = await provider.adminUpsertModule({
      title: "Kiln basics",
      slug: "kiln-basics",
      certificationId: cert.id,
      published: true,
    });
    expect(mod.published).toBe(true);
  });
});

describe("videos", () => {
  it("adds a video from a pasted YouTube link and puts it last in its lesson", async () => {
    const provider = createMockDataProvider(ADMIN);
    const detail = await provider.getModule((await moduleRow(provider)).slug);
    const lesson = detail!.lessons[0]!;
    const lastOrder = Math.max(0, ...lesson.videos.map((v) => v.order));

    const video = await provider.adminUpsertVideo({
      lessonId: lesson.id,
      title: "Fire extinguisher basics",
      url: "https://youtu.be/dQw4w9WgXcQ?t=12",
      role: "supporting",
    });
    expect(video.youtubeId).toBe("dQw4w9WgXcQ");
    expect(video.order).toBe(lastOrder + 1);
    expect(video.provider).toBe("youtube");
    expect(video.staffReviewed).toBe(false);
    expect((await provider.adminListVideos(MODULE)).map((v) => v.id)).toContain(video.id);
  });

  it("keeps the condition for a video that only some members need", async () => {
    const provider = createMockDataProvider(ADMIN);
    const detail = await provider.getModule((await moduleRow(provider)).slug);
    const video = await provider.adminUpsertVideo({
      lessonId: detail!.lessons[0]!.id,
      title: "Left-handed setup",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      role: "conditional",
      condition: "Watch if you are left-handed.",
    });
    expect(video.condition).toBe("Watch if you are left-handed.");
  });

  it("needs a title and a YouTube link it can read", async () => {
    const provider = createMockDataProvider(ADMIN);
    const detail = await provider.getModule((await moduleRow(provider)).slug);
    const lessonId = detail!.lessons[0]!.id;
    await expect(
      provider.adminUpsertVideo({ lessonId, title: " ", url: "https://youtu.be/dQw4w9WgXcQ", role: "primary" }),
    ).rejects.toThrow("Give the video a title.");
    await expect(
      provider.adminUpsertVideo({ lessonId, title: "x", url: "https://example.com/video", role: "primary" }),
    ).rejects.toThrow("Paste the video's YouTube link.");
  });

  it("removes a video and the watch records for it", async () => {
    const provider = createMockDataProvider(ADMIN);
    const video = (await provider.adminListVideos(MODULE))[0]!;
    await provider.markVideoWatched(video.id, "u-maya");
    await provider.adminDeleteVideo(video.id);
    expect((await provider.adminListVideos(MODULE)).map((v) => v.id)).not.toContain(video.id);
  });
});

describe("questions with more than one right answer", () => {
  async function multi(provider: ReturnType<typeof createMockDataProvider>) {
    const q = (await provider.adminListQuestions(MODULE)).find(
      (x) => (x.correctIndexes?.length ?? 0) > 1,
    );
    if (!q) throw new Error("The fixtures have no multi-answer question");
    return q;
  }

  it("survives an edit that does not touch the answers", async () => {
    const provider = createMockDataProvider(ADMIN);
    const q = await multi(provider);
    const saved = await provider.adminUpsertQuestion({
      id: q.id,
      moduleId: q.moduleId,
      prompt: `${q.prompt} (reworded)`,
      choices: q.choices,
      correctIndex: q.correctIndex,
    });
    expect(saved.correctIndexes).toEqual(q.correctIndexes);
    expect(saved.correctIndex).toBe(q.correctIndex);
  });

  it("can be changed to a different set of right answers", async () => {
    const provider = createMockDataProvider(ADMIN);
    const q = await multi(provider);
    const saved = await provider.adminUpsertQuestion({
      id: q.id,
      moduleId: q.moduleId,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: 3,
      correctIndexes: [3, 1],
    });
    expect(saved.correctIndexes).toEqual([1, 3]);
    expect(saved.correctIndex).toBe(1);
  });

  it("becomes a single-answer question when staff pick one answer", async () => {
    const provider = createMockDataProvider(ADMIN);
    const q = await multi(provider);
    const saved = await provider.adminUpsertQuestion({
      id: q.id,
      moduleId: q.moduleId,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: 2,
      correctIndexes: [2],
    });
    expect(saved.correctIndexes).toEqual([2]);
    expect(saved.correctIndex).toBe(2);
  });

  it("takes two to six choices and refuses an answer that is not one of them", async () => {
    const provider = createMockDataProvider(ADMIN);
    const base = { moduleId: MODULE, prompt: "True or false: goggles are optional." };
    const two = await provider.adminUpsertQuestion({
      ...base,
      choices: ["True", "False"],
      correctIndex: 1,
    });
    expect(two.choices).toEqual(["True", "False"]);
    expect(two.correctIndexes).toEqual([1]);

    await expect(
      provider.adminUpsertQuestion({ ...base, choices: ["Only one"], correctIndex: 0 }),
    ).rejects.toThrow("A question needs at least 2 choices.");
    await expect(
      provider.adminUpsertQuestion({ ...base, choices: ["A", " "], correctIndex: 0 }),
    ).rejects.toThrow("Fill in every choice, or remove the empty one.");
    await expect(
      provider.adminUpsertQuestion({ ...base, choices: ["A", "B"], correctIndex: 0, correctIndexes: [0, 2] }),
    ).rejects.toThrow("Tick at least one right answer from the choices.");
    await expect(
      provider.adminUpsertQuestion({ ...base, choices: ["A", "B"], correctIndex: 0, correctIndexes: [] }),
    ).rejects.toThrow("Tick at least one right answer from the choices.");
    await expect(
      provider.adminUpsertQuestion({ ...base, prompt: " ", choices: ["A", "B"], correctIndex: 0 }),
    ).rejects.toThrow("Write the question.");
  });

  it("refuses to drop a choice that was a right answer without new answers", async () => {
    const provider = createMockDataProvider(ADMIN);
    const q = await multi(provider);
    await expect(
      provider.adminUpsertQuestion({
        id: q.id,
        moduleId: q.moduleId,
        prompt: q.prompt,
        choices: q.choices.slice(0, 2),
        correctIndex: q.correctIndex,
      }),
    ).rejects.toThrow("Tick at least one right answer from the choices.");
  });

  it("is graded on the whole set of answers", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod } = await freshModule(provider);
    await provider.adminUpsertQuestion({
      moduleId: mod.id,
      prompt: "Which of these are PPE?",
      choices: ["Safety glasses", "A scarf", "Hearing protection"],
      correctIndex: 0,
      correctIndexes: [0, 2],
    });
    expect((await provider.adminPublishModule(mod.id, true)).ok).toBe(true);

    const first = await provider.startQuiz(mod.id, ADMIN);
    expect(first.questions).toHaveLength(1);
    expect(first.questions[0]!.multi).toBe(true);
    const partial = await provider.submitQuiz({
      attemptToken: first.attemptToken,
      userId: ADMIN,
      moduleId: mod.id,
      questionIds: first.questions.map((q) => q.id),
      answers: [[0]],
    });
    expect(partial.passed).toBe(false);

    const second = await provider.startQuiz(mod.id, ADMIN);
    const whole = await provider.submitQuiz({
      attemptToken: second.attemptToken,
      userId: ADMIN,
      moduleId: mod.id,
      questionIds: second.questions.map((q) => q.id),
      answers: [[2, 0]],
    });
    expect(whole.passed).toBe(true);
    expect(whole.scorePercent).toBe(100);
  });

  it("removes a question from the bank", async () => {
    const provider = createMockDataProvider(ADMIN);
    const q = await multi(provider);
    await provider.adminDeleteQuestion(q.id);
    expect((await provider.adminListQuestions(MODULE)).map((x) => x.id)).not.toContain(q.id);
  });
});

describe("removing a lesson", () => {
  it("takes its videos, watch records and progress with it, and nothing else", async () => {
    const provider = createMockDataProvider(ADMIN);
    const slug = (await moduleRow(provider)).slug;
    const detail = await provider.getModule(slug);
    const lesson = detail!.lessons.find((l) => l.videos.length > 0)!;
    const others = detail!.lessons.filter((l) => l.id !== lesson.id);
    await provider.markVideoWatched(lesson.videos[0]!.id, "u-maya");
    await provider.markLessonComplete(lesson.id, "u-maya");
    type State = {
      lessonProgress: { lessonId: string }[];
      videoWatches: { videoId: string }[];
      userCertifications: unknown[];
    };
    const state = () => (provider as unknown as { getState(): State }).getState();
    const certsBefore = JSON.stringify(state().userCertifications);
    expect(JSON.parse(certsBefore).length).toBeGreaterThan(0);
    const otherVideoIds = others.flatMap((l) => l.videos.map((v) => v.id));

    await provider.adminDeleteLesson(lesson.id);

    const after = await provider.getModule(slug);
    expect(after!.lessons.map((l) => l.id)).toEqual(others.map((l) => l.id));
    const videoIds = (await provider.adminListVideos(MODULE)).map((v) => v.id);
    for (const v of lesson.videos) expect(videoIds).not.toContain(v.id);
    for (const id of otherVideoIds) expect(videoIds).toContain(id);
    expect(state().lessonProgress.some((p) => p.lessonId === lesson.id)).toBe(false);
    expect(
      state().videoWatches.some((w) => lesson.videos.some((v) => v.id === w.videoId)),
    ).toBe(false);
    // What a member has earned is a certification row. A lesson going away never touches it.
    expect(JSON.stringify(state().userCertifications)).toBe(certsBefore);
  });

  it("will not empty a module members can open", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod, lesson } = await freshModule(provider);
    await provider.adminPublishModule(mod.id, true);
    await expect(provider.adminDeleteLesson(lesson.id)).rejects.toThrow(
      "This is the only lesson in a published module. Unpublish the module first.",
    );
    await provider.adminPublishModule(mod.id, false);
    await provider.adminDeleteLesson(lesson.id);
    expect((await provider.getModule(mod.slug))!.lessons).toHaveLength(0);
  });
});

describe("lesson text", () => {
  it("writes the text for a lesson that had none and points the lesson at it", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod, lesson } = await freshModule(provider);
    const page = await provider.adminSaveLessonText(
      lesson.id,
      '<p onclick="x()">Load the <b>bottom shelf</b> first.</p><script>alert(1)</script>',
    );
    expect(page.category).toBe("lesson");
    expect(page.html).toBe("<p>Load the <b>bottom shelf</b> first.</p>");
    const detail = await provider.getModule(mod.slug);
    expect(detail!.lessons[0]!.contentSlug).toBe(page.slug);
    expect(detail!.lessons[0]!.html).toContain("bottom shelf");
  });

  it("changes the same page on the next save, and the page a lesson already has", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { lesson } = await freshModule(provider);
    const first = await provider.adminSaveLessonText(lesson.id, "<p>Draft one.</p>");
    const second = await provider.adminSaveLessonText(lesson.id, "<p>Draft two.</p>");
    expect(second.id).toBe(first.id);
    expect(second.html).toBe("<p>Draft two.</p>");

    // A lesson that already has a page, at an older path-style address.
    const detail = await provider.getModule((await moduleRow(provider)).slug);
    const withPage = detail!.lessons.find((l) => l.html !== "")!;
    const existing = (await provider.adminListContentMappings()).find(
      (p) => p.slug === withPage.contentSlug,
    )!;
    const saved = await provider.adminSaveLessonText(withPage.id, "<p>Welcome, reworded.</p>");
    expect(saved.id).toBe(existing.id);
    expect(saved.slug).toBe(existing.slug);
    const after = await provider.getModule(detail!.slug);
    expect(after!.lessons.find((l) => l.id === withPage.id)!.html).toBe(
      "<p>Welcome, reworded.</p>",
    );
  });

  it("gives a lesson whose old address has no page a page of its own", async () => {
    const provider = createMockDataProvider(ADMIN);
    const detail = await provider.getModule((await moduleRow(provider)).slug);
    const pathLike = detail!.lessons.find(
      (l) => l.contentSlug.includes("/") && l.html === "",
    )!;
    const page = await provider.adminSaveLessonText(pathLike.id, "<p>Call 911 first.</p>");
    expect(page.slug).toMatch(/^[a-z0-9-]+$/);
    const after = await provider.getModule(detail!.slug);
    expect(after!.lessons.find((l) => l.id === pathLike.id)!.html).toContain("Call 911");
  });

  it("lets a lesson be added with just a title, then given its text", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod } = await freshModule(provider);
    const lesson = await provider.adminUpsertLesson({
      moduleId: mod.id,
      title: "Unloading & Cooling",
    });
    expect(lesson.slug).toBe("unloading-cooling");
    expect(lesson.contentSlug).toBe("lesson-kiln-basics-unloading-cooling");
    const page = await provider.adminSaveLessonText(lesson.id, "<p>Wait until it is under 125°F.</p>");
    expect(page.slug).toBe("lesson-kiln-basics-unloading-cooling");
  });

  it("keeps a lesson attached to its text when its details are saved", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod, lesson } = await freshModule(provider);
    const page = await provider.adminSaveLessonText(lesson.id, "<p>Bottom shelf first.</p>");
    await provider.adminUpsertLesson({
      id: lesson.id,
      moduleId: mod.id,
      title: "Loading the kiln safely",
      contentSlug: "",
      estimatedMinutes: 15,
    });
    const after = (await provider.getModule(mod.slug))!.lessons[0]!;
    expect(after.title).toBe("Loading the kiln safely");
    expect(after.estimatedMinutes).toBe(15);
    expect(after.contentSlug).toBe(page.slug);
    expect(after.html).toContain("Bottom shelf first");
  });

  it("refuses a second lesson at the same address in one module", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { mod } = await freshModule(provider);
    await expect(
      provider.adminUpsertLesson({ moduleId: mod.id, title: "Loading", slug: "loading" }),
    ).rejects.toThrow('Another lesson in this module already uses the address "loading".');
  });

  it("needs some text", async () => {
    const provider = createMockDataProvider(ADMIN);
    const { lesson } = await freshModule(provider);
    await expect(provider.adminSaveLessonText(lesson.id, "<p> </p>")).rejects.toThrow(
      "The page has no text yet.",
    );
  });
});

describe("who may call these", () => {
  it("keeps every new learning method staff only", () => {
    for (const name of ["adminDeleteLesson", "adminSaveLessonText"] as const) {
      expect(RPC_RULES[name].access, name).toBe("staff");
    }
  });
});
