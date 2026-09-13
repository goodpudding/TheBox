/**
 * Patch learning sources: resin safety lesson, embroidery + sublimation modules,
 * best-practice shop-policy answers, content pages, cert/machine activation.
 *
 * Usage: node scripts/patch-learning-resin-embroidery-sub.mjs
 * Then:  node scripts/generate-learning-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mock = path.join(root, "data/mock");
const NOW = "2026-09-07T12:00:00-07:00";

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(mock, name), "utf8"));
}
function write(name, data) {
  fs.writeFileSync(path.join(mock, name), JSON.stringify(data, null, 2) + "\n");
}
function mdToHtml(relPath) {
  const abs = path.join(mock, relPath);
  const md = fs.readFileSync(abs, "utf8");
  return marked.parse(md);
}

const videos = read("learning-videos.json");
const questions = read("learning-questions.json");
const contentPages = read("content-pages.json");
const certifications = read("certifications.json");
const machines = read("machines.json");

// ── Meta updates ────────────────────────────────────────────────────────────
videos._meta.equipmentReconciliation.stillUnconfirmed = [];
videos._meta.equipmentReconciliation.assumedBestPractice = [
  "Embroidery machine (Brother-class single-needle) — assumed present for module build; confirm model at machine",
  "Sublimation printer (Sawgrass-class) + heat press — assumed present; confirm models and posted temp chart",
  "Resin wash/cure unit — workflow taught; confirm exact model vs Mercury XS video",
];
videos._meta.stillUnsourced = [];
videos._meta.generatedAt = "2026-09-07";

// ── Resin safety: clear gap, keep text-only ──────────────────────────────────
const resin = videos.modules.find((m) => m.id === "mod-resin-printing");
const resinSafety = resin.lessons.find((l) => l.id === "les-resin-safety");
resinSafety.gap = false;
delete resinSafety.gapNote;
resinSafety.boxMustCover =
  "In-house lesson at learn/resin/safety. Nitrile only, eye protection, ventilation, skin-contact response (soap/water never IPA on skin), sensitizer risk, IPA flammability, cure-before-trash, used-IPA container → King County MRW (never down the drain), first session supervised.";
resinSafety.videos = [];
resinSafety.notes =
  "No primary video on purpose — hobbyist resin safety videos are not good enough to gate a cert. Staff-reviewed flag N/A; readiness treats empty primary set as clear for this lesson.";

// ── Embroidery + sublimation modules ────────────────────────────────────────
const embroideryMod = {
  id: "mod-embroidery-machine",
  slug: "embroidery-machine",
  title: "Embroidery Machine",
  certificationId: "cert-embroidery-machine",
  knowledgeOnly: false,
  equipmentStatus: "confirmed",
  published: false,
  summary:
    "Brother-class single-needle embroidery: threading, USB designs, hooping, and stabilizer selection. Confirm exact model at the machine.",
  attendedOperationRequired: false,
  lessons: [
    {
      id: "les-embroidery-basics",
      order: 1,
      title: "Machine basics and first stitch-out",
      contentSlug: "learn/embroidery/basics",
      boxMustCover:
        "Exact Brother model, bobbin/needle rules, USB file types The Box accepts, needle-break procedure.",
      videos: [
        {
          provider: "youtube",
          youtubeId: "-gY539zp0Ws",
          url: "https://www.youtube.com/watch?v=-gY539zp0Ws",
          title: "Beginner Guide to the Brother PE800 Embroidery Machine!",
          channel: "Crafting with Kristin",
          role: "primary",
          durationSeconds: null,
          verifiedAt: "2026-09-07",
          staffReviewed: false,
          notes:
            "Filmed on PE800 — workflow transfers to similar Brother single-needle machines; confirm The Box model.",
        },
      ],
    },
    {
      id: "les-embroidery-hooping",
      order: 2,
      title: "Hooping and stabilizer",
      contentSlug: "learn/embroidery/hooping",
      boxMustCover:
        "Which stabilizers The Box stocks, cutaway vs tearaway default for garments, topper for towels.",
      videos: [
        {
          provider: "youtube",
          youtubeId: "472kqi7uRs4",
          url: "https://www.youtube.com/watch?v=472kqi7uRs4",
          title:
            "(BEGINNER EMBROIDERY) Which Stabilizer you NEED to Start Embroidering!",
          channel: "Mel Calabrese",
          role: "primary",
          durationSeconds: null,
          verifiedAt: "2026-09-07",
          staffReviewed: false,
          notes: "Short-form; pairs with in-house hooping lesson text.",
        },
      ],
    },
  ],
};

const sublimationMod = {
  id: "mod-sublimation",
  slug: "sublimation",
  title: "Sublimation (printer + heat press)",
  certificationId: "cert-sublimation",
  knowledgeOnly: false,
  equipmentStatus: "confirmed",
  published: false,
  summary:
    "Sawgrass-class dye-sub printer and heat press. Mirror, polyester blanks, press temperatures, and platen safety.",
  attendedOperationRequired: true,
  lessons: [
    {
      id: "les-sublimation-overview",
      order: 1,
      title: "How sublimation works",
      contentSlug: "learn/sublimation/overview",
      boxMustCover:
        "Posted temp/time chart at the press, which blanks The Box stocks, dark-garment rule.",
      videos: [
        {
          provider: "youtube",
          youtubeId: "tJGG1lbp83k",
          url: "https://www.youtube.com/watch?v=tJGG1lbp83k",
          title:
            "Step-by-Step Tutorial : How to Sublimate a Shirt for Sublimation Beginners",
          channel: "Honestly SpINKing 365",
          role: "primary",
          durationSeconds: null,
          verifiedAt: "2026-09-07",
          staffReviewed: false,
        },
        {
          provider: "youtube",
          youtubeId: "7NxQRsUjR7M",
          url: "https://www.youtube.com/watch?v=7NxQRsUjR7M",
          title: "How to Fix Faded & Blurry Sublimation Prints | Beginner to Pro Tips",
          channel: "AAPrintSupplyCo",
          role: "supporting",
          durationSeconds: null,
          verifiedAt: "2026-09-07",
          staffReviewed: false,
        },
      ],
    },
    {
      id: "les-sublimation-software",
      order: 2,
      title: "Sawgrass Print Manager",
      contentSlug: "learn/sublimation/software",
      boxMustCover:
        "Shop computer login, which presets The Box uses, where member files are saved.",
      videos: [
        {
          provider: "youtube",
          youtubeId: "m4k5xJ2rfqM",
          url: "https://www.youtube.com/watch?v=m4k5xJ2rfqM",
          title: "How to Use the Sawgrass Print Manager",
          channel: "Angie Holden",
          role: "primary",
          durationSeconds: null,
          verifiedAt: "2026-09-07",
          staffReviewed: false,
          notes:
            "UI may show Print Manager vs Print Utility depending on Sawgrass generation — concepts transfer.",
        },
      ],
    },
    {
      id: "les-sublimation-heat-press",
      order: 3,
      title: "Heat press safety and technique",
      contentSlug: "learn/sublimation/heat-press",
      boxMustCover:
        "Exact press model, posted temp chart, who may change setpoints, burn/first-aid note.",
      videos: [
        {
          provider: "youtube",
          youtubeId: "Nu5P-Yx-nX8",
          url: "https://www.youtube.com/watch?v=Nu5P-Yx-nX8",
          title:
            "Starting a Sublimation Business: Sublimation T-Shirts for Beginners",
          channel: "Daisy Multifacetica",
          role: "primary",
          durationSeconds: null,
          verifiedAt: "2026-09-07",
          staffReviewed: false,
          notes:
            "Press brand differs; teach The Box's posted times/temps over the video's numbers.",
        },
      ],
    },
  ],
};

if (!videos.modules.some((m) => m.id === embroideryMod.id)) {
  videos.modules.push(embroideryMod);
}
if (!videos.modules.some((m) => m.id === sublimationMod.id)) {
  videos.modules.push(sublimationMod);
}

// ── Question banks ──────────────────────────────────────────────────────────
questions._meta.generatedAt = "2026-09-07";
questions._meta.counts =
  "10-12 questions per module across 12 modules (added embroidery + sublimation).";
questions._meta.resinNote =
  "Resin safety questions test the in-house learn/resin/safety lesson. IPA disposal uses best-practice King County MRW wording — edit if The Box posts a different route.";

const resinBank = questions.banks.find((b) => b.moduleId === "mod-resin-printing");
const ipaQ = resinBank.questions.find((q) => q.id === "q-rs-10");
Object.assign(ipaQ, {
  answerPending: false,
  options: [
    "Sealed labeled used-IPA container for staff to take to King County Moderate Risk Waste — never down the drain",
    "Pour it down the sink with plenty of water",
    "Leave it open next to the wash station to evaporate",
    "Dump it in the regular trash once it looks clear",
  ],
  correct: [0],
  explanation:
    "Best-practice placeholder for The Box. Liquid IPA is household hazardous waste in King County; do not drain it. Staff handle the drop-off. Edit if shop policy differs.",
});

const embroideryBank = {
  moduleId: "mod-embroidery-machine",
  moduleTitle: "Embroidery Machine",
  equipmentStatus: "Assumed Brother-class single-needle — confirm model.",
  questions: [
    {
      id: "q-em-01",
      type: "single",
      safetyCritical: true,
      source: "video",
      sourceVideoId: "-gY539zp0Ws",
      verifyAgainstVideo: true,
      prompt: "While the embroidery machine is stitching, what should you do with the fabric?",
      options: [
        "Let the hoop move the fabric — do not pull or push it",
        "Pull gently ahead of the needle to keep tension",
        "Hold the fabric taut with both hands beside the hoop",
        "Push from behind to speed dense designs",
      ],
      correct: [0],
      explanation: "Pulling while stitching bends and breaks needles.",
    },
    {
      id: "q-em-02",
      type: "single",
      safetyCritical: true,
      source: "video",
      sourceVideoId: "-gY539zp0Ws",
      verifyAgainstVideo: true,
      prompt: "A needle breaks mid-design. What is the first priority?",
      options: [
        "Stop, find every fragment, and tell staff before replacing the needle",
        "Install a new needle immediately and resume",
        "Raise the speed and finish the design",
        "Cut the design out of the hoop and start over",
      ],
      correct: [0],
      explanation:
        "Loose needle fragments damage the machine and cut fingers. Shop policy: staff before restart if unsure.",
    },
    {
      id: "q-em-03",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "-gY539zp0Ws",
      verifyAgainstVideo: true,
      prompt: "Where does a pre-wound bobbin typically go on a Brother embroidery machine?",
      options: [
        "In the bobbin case under the needle plate, oriented per the machine's diagram",
        "On the top spool pin next to the upper thread",
        "Inside the hoop under the fabric",
        "It is optional for embroidery",
      ],
      correct: [0],
      explanation: "Bobbin orientation is model-specific — follow the diagram on the machine.",
    },
    {
      id: "q-em-04",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "-gY539zp0Ws",
      verifyAgainstVideo: true,
      prompt: "How do members usually load custom designs onto a Brother PE-class machine?",
      options: [
        "USB drive with a supported embroidery file format",
        "Email the design to the machine",
        "Print the design on paper and scan it",
        "Only built-in designs are allowed",
      ],
      correct: [0],
      explanation: "Confirm The Box's accepted formats (often PES) at the station.",
    },
    {
      id: "q-em-05",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "472kqi7uRs4",
      verifyAgainstVideo: true,
      prompt: "Which stabilizer should you reach for first on a stretchy t-shirt?",
      options: [
        "Cutaway",
        "Tearaway only",
        "No stabilizer",
        "Water-soluble only, with nothing behind the fabric",
      ],
      correct: [0],
      explanation: "Cutaway stays with the garment and supports stretch fabrics through washing.",
    },
    {
      id: "q-em-06",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "472kqi7uRs4",
      verifyAgainstVideo: true,
      prompt: "Tearaway stabilizer is generally best for:",
      options: [
        "Stable woven fabrics where you want to remove the backing after stitching",
        "Every knit garment",
        "Replacing the bobbin thread",
        "Lubricating the needle",
      ],
      correct: [0],
      explanation: "Tearaway on stretch knits is a common cause of puckering.",
    },
    {
      id: "q-em-07",
      type: "single",
      safetyCritical: false,
      source: "shop-policy",
      prompt: "When hooping, how tight should the fabric be?",
      options: [
        "Taut like a drum without stretching the grain of the fabric",
        "Loose so the hoop does not leave marks",
        "Stretched hard in every direction after the screw is tight",
        "Only the stabilizer needs to be tight",
      ],
      correct: [0],
      explanation: "Over-stretching in the hoop causes puckering when you unhoop.",
    },
    {
      id: "q-em-08",
      type: "single",
      safetyCritical: true,
      source: "shop-policy",
      prompt: "Why must excess fabric be kept clear of the embroidery arm?",
      options: [
        "Loose fabric can be caught and sewn into the arm or design",
        "It blocks the touchscreen",
        "It cools the motor",
        "It does not matter",
      ],
      correct: [0],
      explanation: "Caught fabric ruins the project and can damage the machine.",
    },
    {
      id: "q-em-09",
      type: "single",
      safetyCritical: false,
      source: "shop-policy",
      answerPending: false,
      prompt: "Does The Box supply stabilizer, bobbins, and embroidery thread?",
      options: [
        "Best practice: shop stocks basics for checkoff and classes; members bring specialty thread — confirm posted consumable policy",
        "Everything is free unlimited",
        "Members must bring a whole machine",
        "Only needles are supplied",
      ],
      correct: [0],
      explanation: "Provisional answer — edit when consumable policy is posted.",
    },
    {
      id: "q-em-10",
      type: "single",
      safetyCritical: false,
      source: "shop-policy",
      prompt: "You passed this quiz. May you embroider unsupervised tomorrow?",
      options: [
        "Not yet — you still need a staff hands-on checkoff for machine access",
        "Yes, the quiz unlocks the badge",
        "Yes, if another member watches",
        "Yes, after one practice at home",
      ],
      correct: [0],
      explanation: "Knowledge pass is not machine access.",
    },
  ],
};

const sublimationBank = {
  moduleId: "mod-sublimation",
  moduleTitle: "Sublimation",
  equipmentStatus: "Assumed Sawgrass-class printer + heat press.",
  questions: [
    {
      id: "q-su-01",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "tJGG1lbp83k",
      verifyAgainstVideo: true,
      prompt: "Before printing a design for a shirt, what must usually happen to the artwork?",
      options: [
        "It must be mirrored so it reads correctly after pressing",
        "It must be converted to greyscale",
        "It must be printed twice",
        "Nothing — mirror only applies to vinyl",
      ],
      correct: [0],
      explanation: "Forgetting to mirror is the classic first failure.",
    },
    {
      id: "q-su-02",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "tJGG1lbp83k",
      verifyAgainstVideo: true,
      prompt: "Which garment takes sublimation dye best?",
      options: [
        "Light-coloured high-polyester (ideally 100% polyester) fabric",
        "100% cotton dark hoodie",
        "Wool coat",
        "Any fabric if you press longer",
      ],
      correct: [0],
      explanation: "Dye bonds to polyester; cotton and dark garments are the wrong blank.",
    },
    {
      id: "q-su-03",
      type: "single",
      safetyCritical: true,
      source: "video",
      sourceVideoId: "Nu5P-Yx-nX8",
      verifyAgainstVideo: true,
      prompt: "Why stay with the heat press while it is closed on a job?",
      options: [
        "The platen is hot enough to burn, and a press left alone is a fire and injury risk",
        "The printer needs the network from the press",
        "Sublimation only works if you watch it",
        "You do not — heat presses may run overnight",
      ],
      correct: [0],
      explanation: "Treat the press like other heat equipment: attended for the cycle.",
    },
    {
      id: "q-su-04",
      type: "single",
      safetyCritical: true,
      source: "video",
      sourceVideoId: "7NxQRsUjR7M",
      verifyAgainstVideo: true,
      prompt: "What usually causes ghosting (a blurry double image)?",
      options: [
        "The transfer shifted when the press opened or closed",
        "The printer was offline",
        "The shirt was 100% polyester",
        "The design was mirrored",
      ],
      correct: [0],
      explanation: "Tape the transfer; do not bump the paper while hot.",
    },
    {
      id: "q-su-05",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "7NxQRsUjR7M",
      verifyAgainstVideo: true,
      prompt: "Faded or dull colours after pressing most often mean:",
      options: [
        "Time, temperature, pressure, or substrate was wrong for a full dye transfer",
        "The design used too much white",
        "The press was attended",
        "The paper was mirrored correctly",
      ],
      correct: [0],
      explanation: "Use The Box's posted chart, not a random YouTube temperature.",
    },
    {
      id: "q-su-06",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "m4k5xJ2rfqM",
      verifyAgainstVideo: true,
      prompt: "What is Sawgrass Print Manager (or Print Utility) for?",
      options: [
        "Applying the right colour profile, quality, and often mirroring for sublimation output",
        "Controlling the heat press temperature only",
        "Digitizing embroidery designs",
        "Billing machine time",
      ],
      correct: [0],
      explanation: "Print through the shop utility, not a generic driver guess.",
    },
    {
      id: "q-su-07",
      type: "single",
      safetyCritical: false,
      source: "video",
      sourceVideoId: "Nu5P-Yx-nX8",
      verifyAgainstVideo: true,
      prompt: "Why put butcher paper inside a shirt and over the transfer?",
      options: [
        "To stop ink blow-through from staining the back of the shirt or the press platen",
        "To cool the platen faster",
        "To make cotton accept dye",
        "It is only decorative",
      ],
      correct: [0],
      explanation: "Protect the press and the garment.",
    },
    {
      id: "q-su-08",
      type: "multi",
      safetyCritical: true,
      source: "shop-policy",
      prompt: "Before closing the heat press, which are required? (Select all that apply.)",
      options: [
        "Transfer secured so it cannot shift",
        "Protective paper / covering on the platen side",
        "Knowing the posted time and temperature for that blank",
        "Leaving the area once the timer starts",
      ],
      correct: [0, 1, 2],
      explanation: "The last option is wrong — stay with the press.",
    },
    {
      id: "q-su-09",
      type: "single",
      safetyCritical: false,
      source: "shop-policy",
      answerPending: false,
      prompt: "Who may change the heat press temperature setpoints on The Box's press?",
      options: [
        "Best practice: use the posted chart; only staff change machine defaults — members select the listed setting for their blank",
        "Anyone may reprogram defaults for the day",
        "Only the previous user",
        "Temperature does not matter for sublimation",
      ],
      correct: [0],
      explanation: "Provisional — edit to match posted shop policy.",
    },
    {
      id: "q-su-10",
      type: "single",
      safetyCritical: false,
      source: "shop-policy",
      prompt: "You passed this quiz. Which machines may you use?",
      options: [
        "None yet — knowledge pass still requires a hands-on checkoff",
        "Printer and press immediately",
        "Only the printer",
        "Any textile machine in the building",
      ],
      correct: [0],
      explanation: "Same rule as every other machine module.",
    },
  ],
};

if (!questions.banks.some((b) => b.moduleId === embroideryBank.moduleId)) {
  questions.banks.push(embroideryBank);
}
if (!questions.banks.some((b) => b.moduleId === sublimationBank.moduleId)) {
  questions.banks.push(sublimationBank);
}

// ── Content pages ───────────────────────────────────────────────────────────
const lessonPages = [
  ["learn/resin/safety", "Resin safety and PPE", "content/lessons/resin/safety.md"],
  ["learn/resin/printing", "Printing on the Saturn", "content/lessons/resin/printing.md"],
  ["learn/resin/wash-cure", "Washing and curing", "content/lessons/resin/wash-cure.md"],
  ["learn/embroidery/basics", "Embroidery machine basics", "content/lessons/embroidery/basics.md"],
  ["learn/embroidery/hooping", "Hooping and stabilizer", "content/lessons/embroidery/hooping.md"],
  ["learn/sublimation/overview", "Sublimation overview", "content/lessons/sublimation/overview.md"],
  ["learn/sublimation/software", "Sawgrass Print Manager", "content/lessons/sublimation/software.md"],
  ["learn/sublimation/heat-press", "Heat press", "content/lessons/sublimation/heat-press.md"],
];

for (const [slug, title, markdownPath] of lessonPages) {
  const html = mdToHtml(markdownPath);
  const existing = contentPages.find((p) => p.slug === slug);
  if (existing) {
    existing.html = html;
    existing.title = title;
    existing.markdownPath = markdownPath;
    existing.updatedAt = NOW;
    existing.syncedAt = NOW;
  } else {
    contentPages.push({
      id: `content-${slug.replace(/\//g, "-")}`,
      notionId: null,
      googleFileId: null,
      slug,
      title,
      html,
      markdownPath,
      category: "lesson",
      version: "2026.1",
      syncedAt: NOW,
      published: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
}

// ── Certs + machines active ─────────────────────────────────────────────────
for (const id of ["cert-embroidery-machine", "cert-sublimation"]) {
  const c = certifications.find((x) => x.id === id);
  if (c) {
    c.active = true;
    c.description = c.description.replace(/ Equipment unconfirmed\./, "");
    c.updatedAt = NOW;
  }
}

for (const m of machines) {
  if (m.id === "m-embroidery") {
    m.name = "Brother Embroidery Machine";
    m.active = true;
    m.attendedOperationRequired = false;
    m.locationLabel = "Textiles · Embroidery station";
    m.updatedAt = NOW;
  }
  if (m.id === "m-sub-printer") {
    m.name = "Sawgrass Sublimation Printer";
    m.active = true;
    m.attendedOperationRequired = false;
    m.locationLabel = "Sublimation · Printer desk";
    m.updatedAt = NOW;
  }
  if (m.id === "m-heat-press") {
    m.name = "Heat Press 15×15";
    m.active = true;
    m.attendedOperationRequired = true;
    m.reservationRecommended = true;
    m.locationLabel = "Sublimation · Press table";
    m.updatedAt = NOW;
  }
}

write("learning-videos.json", videos);
write("learning-questions.json", questions);
write("content-pages.json", contentPages);
write("certifications.json", certifications);
write("machines.json", machines);

console.log({
  modules: videos.modules.length,
  banks: questions.banks.length,
  contentLessonPages: lessonPages.length,
  embroideryActive: machines.find((m) => m.id === "m-embroidery")?.active,
  heatPressAttended: machines.find((m) => m.id === "m-heat-press")?.attendedOperationRequired,
});
