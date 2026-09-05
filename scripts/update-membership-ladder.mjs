import fs from "fs";
const ts = "2026-09-04T12:00:00-07:00";
const created = "2025-06-01T10:00:00-07:00";

const products = [
  {
    id: "mp-day",
    tier: "day",
    name: "Day pass",
    summary:
      "One-day shop access. Credits toward your first month if you join within 30 days.",
    priceCents: 2000,
    billingInterval: "daily",
    annualPriceCents: null,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: false,
    sortOrder: 10,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-community",
    tier: "community",
    name: "Community rate",
    summary:
      "Self-selected reduced rate for students, seniors, or anyone for whom $40 is a barrier. Honor system — choosing a reduced rate you don’t need takes a seat from someone who does. Capped seats.",
    priceCents: 2000,
    billingInterval: "monthly",
    annualPriceCents: null,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: false,
    sortOrder: 20,
    isAddOn: false,
    cappedSeats: 12,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-maker",
    tier: "maker",
    name: "Maker",
    summary:
      "Full member access: certifications, reservations, classes, and the shop. The anchor membership.",
    priceCents: 4000,
    billingInterval: "monthly",
    annualPriceCents: 40000,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: true,
    sortOrder: 30,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-household",
    tier: "household_addon",
    name: "Household add-on",
    summary:
      "Additional adult at the same address, sharing the primary member’s plan. Teens 14–17 free under a guardian member (pending insurance confirmation).",
    priceCents: 2000,
    billingInterval: "monthly",
    annualPriceCents: null,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: false,
    sortOrder: 40,
    isAddOn: true,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-patron",
    tier: "patron",
    name: "Patron",
    summary:
      "A Maker membership plus $20/month straight into the scholarship fund. Name on the donor board and first look at new equipment. Every two Patrons fund one full scholarship seat.",
    priceCents: 6000,
    billingInterval: "monthly",
    annualPriceCents: 60000,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: false,
    sortOrder: 50,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-friend",
    tier: "friend",
    name: "Friend of The Box",
    summary:
      "No shop access. Newsletter, member-night invites, 10% off classes, and a sticker — for neighbors and supporters who want to belong without making.",
    priceCents: 1000,
    billingInterval: "monthly",
    annualPriceCents: 10000,
    shopAccess: false,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: false,
    sortOrder: 60,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-scholarship",
    tier: "scholarship",
    name: "Scholarship seat",
    summary:
      "A full Maker membership for six months, renewable, funded by Patrons and earmarked donations. Short application — priority for Burien residents, youth programs, and partner referrals.",
    priceCents: 0,
    billingInterval: "none",
    annualPriceCents: null,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: false,
    highlight: false,
    sortOrder: 70,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-steward",
    tier: "shop_steward",
    name: "Shop Steward",
    summary:
      "Volunteer four hours a week (one shift) and receive a free Maker membership plus free certifications. Apply on the Volunteer page.",
    priceCents: 0,
    billingInterval: "none",
    annualPriceCents: null,
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: false,
    highlight: false,
    sortOrder: 80,
    isAddOn: false,
    cappedSeats: 4,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-pro",
    tier: "maker_pro",
    name: "Maker Pro",
    summary:
      "Maker plus a storage cubby, priority reservations, two guest passes a month, and a Made in Burien directory listing. Launches once badge access can enforce priority booking.",
    priceCents: 7500,
    billingInterval: "monthly",
    annualPriceCents: null,
    shopAccess: true,
    phase: 3,
    visibleOnJoin: true,
    joinable: false,
    highlight: false,
    sortOrder: 90,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-unlimited",
    tier: "unlimited",
    name: "Unlimited",
    summary:
      "Everything in Maker Pro, unlimited machine time (even if hourly laser/plasma fees arrive), and a weekly one-hour staff mentorship. Capped at six seats.",
    priceCents: 12000,
    billingInterval: "monthly",
    annualPriceCents: null,
    shopAccess: true,
    phase: 3,
    visibleOnJoin: true,
    joinable: false,
    highlight: false,
    sortOrder: 100,
    isAddOn: false,
    cappedSeats: 6,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "mp-team",
    tier: "team",
    name: "Team",
    summary:
      "Up to four employees of one business, plus a discount on a team-building event. Pairs with corporate event bookings.",
    priceCents: 120000,
    billingInterval: "annual",
    annualPriceCents: null,
    shopAccess: true,
    phase: 3,
    visibleOnJoin: true,
    joinable: false,
    highlight: false,
    sortOrder: 110,
    isAddOn: false,
    cappedSeats: null,
    createdAt: created,
    updatedAt: ts,
  },
];

fs.writeFileSync(
  "data/mock/membership-products.json",
  JSON.stringify(products, null, 2) + "\n",
);

const settings = {
  orgName: "The Box · Discover Burien Makerspace",
  paymentUrl: "https://www.zeffy.com/en-US/donation-form/example-the-box",
  donationUrl: "https://www.zeffy.com/en-US/donation-form/example-the-box-donate",
  scholarshipDonationUrl:
    "https://www.zeffy.com/en-US/donation-form/example-the-box-scholarship",
  contactEmail: "thebox@discoverburien.org",
  hoursContentSlug: "hours",
  currentWaiverVersion: "2026.1",
  memberExpectationsPolicySlug: "member-expectations",
  quizPassThresholdPercent: 80,
  quizAttemptLimit: 3,
  quizQuestionCount: 10,
  classCancellationCutoffHours: 24,
  paymentHoldHours: 48,
  reservationHorizonDays: 14,
  maxHoursPerDay: 3,
  maxOpenReservations: 3,
  reservationSlotMinutes: 30,
  communitySeatCap: 12,
  makerMonthlyCents: 4000,
  patronScholarshipSurchargeCents: 2000,
  scholarshipFundBalanceCents: 16000,
  scholarshipSeatsAwarded: 2,
  showPhase3Tiers: true,
  updatedAt: ts,
};
fs.writeFileSync(
  "data/mock/settings.json",
  JSON.stringify(settings, null, 2) + "\n",
);

const users = JSON.parse(fs.readFileSync("data/mock/users.json", "utf8"));

const tierMap = {
  monthly: { tier: "maker", billingInterval: "monthly", shopAccess: true },
  annual: { tier: "maker", billingInterval: "annual", shopAccess: true },
  student: { tier: "community", billingInterval: "monthly", shopAccess: true },
  daily: { tier: "day", billingInterval: "daily", shopAccess: true },
};

for (const u of users) {
  delete u.studentIdVerified;
  if (u.tier == null) {
    u.billingInterval = null;
    u.shopAccess = false;
    continue;
  }
  const mapped = tierMap[u.tier];
  if (mapped) {
    Object.assign(u, mapped);
  } else if (u.shopAccess == null) {
    u.shopAccess = true;
    u.billingInterval = u.billingInterval ?? "monthly";
  }
}

// Specialize a few users for the new ladder
const byId = Object.fromEntries(users.map((u) => [u.id, u]));
Object.assign(byId["u-sam"], {
  tier: "community",
  billingInterval: "monthly",
  shopAccess: true,
  _notes: "Community rate seat (replaces former student tier)",
});
Object.assign(byId["u-jordan"], {
  tier: "patron",
  billingInterval: "annual",
  shopAccess: true,
  _notes: "Patron — $20/mo equivalent funds scholarship seats",
});
Object.assign(byId["u-riley"], {
  tier: "day",
  billingInterval: "daily",
  shopAccess: true,
  dayPassCreditExpiresAt: "2026-10-04T23:59:59-07:00",
  _notes: "Day pass with join credit window open 30 days",
});
Object.assign(byId["u-kai"], {
  tier: "friend",
  billingInterval: "monthly",
  shopAccess: false,
  _notes: "Friend of The Box — supporter, no shop access",
});

const extras = [
  {
    id: "u-harper",
    email: "harper.diaz@example.com",
    firstName: "Harper",
    lastName: "Diaz",
    displayName: "Harper Diaz",
    phone: "+1-206-555-0401",
    role: "member",
    status: "active",
    tier: "scholarship",
    billingInterval: "none",
    shopAccess: true,
    scholarshipExpiresAt: "2027-03-01T00:00:00-07:00",
    emergencyContactName: "Rosa Diaz",
    emergencyContactPhone: "+1-206-555-0402",
    emergencyContactRelation: "parent",
    profileComplete: true,
    _notes: "Scholarship seat — six months funded by Patron pool",
    createdAt: "2026-09-01T10:00:00-07:00",
    updatedAt: ts,
  },
  {
    id: "u-skye",
    email: "skye.park@example.com",
    firstName: "Skye",
    lastName: "Park",
    displayName: "Skye Park",
    phone: "+1-206-555-0403",
    role: "member",
    status: "active",
    tier: "household_addon",
    billingInterval: "monthly",
    shopAccess: true,
    householdPrimaryUserId: "u-nova",
    emergencyContactName: "Jin Park",
    emergencyContactPhone: "+1-206-555-0210",
    emergencyContactRelation: "spouse",
    profileComplete: true,
    _notes: "Household add-on on Nova Park’s Maker plan",
    createdAt: "2025-08-01T10:00:00-07:00",
    updatedAt: ts,
  },
  {
    id: "u-reed",
    email: "reed.foster@example.com",
    firstName: "Reed",
    lastName: "Foster",
    displayName: "Reed Foster",
    phone: "+1-206-555-0405",
    role: "member",
    status: "active",
    tier: "shop_steward",
    billingInterval: "none",
    shopAccess: true,
    emergencyContactName: "Casey Foster",
    emergencyContactPhone: "+1-206-555-0406",
    emergencyContactRelation: "partner",
    profileComplete: true,
    _notes: "Shop Steward — 4 hrs/week for free Maker membership",
    createdAt: "2025-10-01T10:00:00-07:00",
    updatedAt: ts,
  },
];

const merged = [...users.filter((u) => !extras.some((e) => e.id === u.id)), ...extras];
fs.writeFileSync("data/mock/users.json", JSON.stringify(merged, null, 2) + "\n");

// Support + wishlist content pages
const pages = JSON.parse(fs.readFileSync("data/mock/content-pages.json", "utf8"));
const supportPages = [
  {
    id: "content-support",
    notionId: null,
    slug: "support",
    title: "Support The Box",
    html:
      "<p>Membership keeps the lights on. Donations and sponsorships open the door wider — scholarships, tools, and programs for Burien neighbors who couldn’t otherwise join.</p>",
    markdownPath: "content/support/support.md",
    category: "other",
    version: "2026.1",
    syncedAt: ts,
    published: true,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "content-wishlist",
    notionId: null,
    slug: "wishlist",
    title: "Wishlist",
    html:
      "<ul><li>Laser tube replacement — $800</li><li>Bandsaw blades &amp; maintenance kit — $150</li><li>Bin of batting for sewing classes — $75</li><li>Sponsor a kid’s seat in the homeschool program — $50</li></ul>",
    markdownPath: "content/support/wishlist.md",
    category: "other",
    version: "2026.1",
    syncedAt: ts,
    published: true,
    createdAt: created,
    updatedAt: ts,
  },
  {
    id: "content-sponsors",
    notionId: null,
    slug: "business-sponsors",
    title: "Business sponsorships",
    html:
      "<p><strong>Bench Sponsor — $500/yr</strong> Name plate on a workbench.</p><p><strong>Machine Sponsor — $1,500–2,500/yr</strong> Logo on the laser or plasma table; mention in every class that uses it.</p><p><strong>Founding Sponsor — $5,000/yr</strong> All of the above plus a hosted team event.</p><p>Every sponsorship also funds scholarship seats.</p>",
    markdownPath: "content/support/business-sponsors.md",
    category: "other",
    version: "2026.1",
    syncedAt: ts,
    published: true,
    createdAt: created,
    updatedAt: ts,
  },
];
for (const sp of supportPages) {
  const i = pages.findIndex((p) => p.slug === sp.slug);
  if (i >= 0) pages[i] = sp;
  else pages.push(sp);
}
fs.writeFileSync(
  "data/mock/content-pages.json",
  JSON.stringify(pages, null, 2) + "\n",
);

fs.mkdirSync("data/mock/content/support", { recursive: true });
fs.writeFileSync(
  "data/mock/content/support/support.md",
  `# Support The Box

Membership keeps the lights on. Donations and sponsorships open the door wider — scholarships, tools, and programs for Burien neighbors who couldn’t otherwise join.
`,
);
fs.writeFileSync(
  "data/mock/content/support/wishlist.md",
  `# Wishlist

- Laser tube replacement — $800
- Bandsaw blades & maintenance kit — $150
- Bin of batting for sewing classes — $75
- Sponsor a kid’s seat in the homeschool program — $50
`,
);
fs.writeFileSync(
  "data/mock/content/support/business-sponsors.md",
  `# Business sponsorships

**Bench Sponsor — $500/yr** Name plate on a workbench.

**Machine Sponsor — $1,500–2,500/yr** Logo on the laser or plasma table; mention in every class that uses it.

**Founding Sponsor — $5,000/yr** All of the above plus a hosted team event.

Every sponsorship also funds scholarship seats.
`,
);

fs.writeFileSync(
  "data/mock/content/volunteer/shop-steward.md",
  `# Shop Steward

Volunteer **four hours a week** (one shift) and receive a **free Maker membership** plus free certifications — modeled on Seattle Makers’ Maketeer program.

Stewards are how a small shop runs evenings and weekends with two full-time staff. We start with a handful of trusted members on club nights and grow from there.

Apply with the interest form below (choose Shop Steward).
`,
);

const steward = pages.find((p) => p.slug === "volunteer-shop-steward");
if (steward) {
  steward.html =
    "<p>Volunteer <strong>four hours a week</strong> (one shift) and receive a <strong>free Maker membership</strong> plus free certifications.</p><p>Stewards help staff evenings and weekends. Apply below and choose Shop Steward.</p>";
  steward.updatedAt = ts;
  fs.writeFileSync(
    "data/mock/content-pages.json",
    JSON.stringify(pages, null, 2) + "\n",
  );
}

console.log("membership ladder fixtures updated", {
  products: products.length,
  users: merged.length,
});
