/**
 * Generates the complete The Box Portal mock fixture set under data/mock/.
 * Run: node scripts/generate-mock-fixtures.mjs
 * Usage sessions are produced via scripts/generate-usage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateUsageSessions } from "./generate-usage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MOCK = path.join(ROOT, "data", "mock");
const CONTENT = path.join(MOCK, "content");

const NOW = "2026-09-04T12:00:00-07:00";
const T0 = "2025-06-01T10:00:00-07:00";
const TZ = "-07:00";

function ts(dateStr) {
  // Accept "2026-09-04T10:00:00" or full ISO; ensure -07:00
  if (dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  return `${dateStr}${TZ}`;
}

function writeJson(name, data) {
  const p = path.join(MOCK, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  return Array.isArray(data) ? data.length : 1;
}

function writeMd(relPath, body) {
  const p = path.join(CONTENT, relPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body.trim() + "\n", "utf8");
}

function para(...paragraphs) {
  return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

function mdParas(...paragraphs) {
  return paragraphs.join("\n\n");
}

// ─── Users ───────────────────────────────────────────────────────────────────
const users = [
  {
    id: "u-admin",
    email: "admin@example.com",
    firstName: "Avery",
    lastName: "Admin",
    displayName: "Avery Admin",
    phone: "+1-206-555-0100",
    role: "admin",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Pat Admin",
    emergencyContactPhone: "+1-206-555-0101",
    emergencyContactRelation: "spouse",
    profileComplete: true,
    createdAt: ts("2025-01-10T09:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-staff",
    email: "staff@example.com",
    firstName: "Sam",
    lastName: "Stafford",
    displayName: "Sam Stafford",
    phone: "+1-206-555-0102",
    role: "staff",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Lee Stafford",
    emergencyContactPhone: "+1-206-555-0103",
    emergencyContactRelation: "partner",
    profileComplete: true,
    createdAt: ts("2025-02-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-maya",
    email: "maya.chen@example.com",
    firstName: "Maya",
    lastName: "Chen",
    displayName: "Maya Chen",
    phone: "+1-206-555-0201",
    role: "member",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Wei Chen",
    emergencyContactPhone: "+1-206-555-0202",
    emergencyContactRelation: "parent",
    profileComplete: true,
    createdAt: ts("2025-03-15T11:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-jordan",
    email: "jordan.lee@example.com",
    firstName: "Jordan",
    lastName: "Lee",
    displayName: "Jordan Lee",
    phone: "+1-206-555-0203",
    role: "member",
    status: "active",
    tier: "annual",
    emergencyContactName: "Chris Lee",
    emergencyContactPhone: "+1-206-555-0204",
    emergencyContactRelation: "sibling",
    profileComplete: true,
    createdAt: ts("2025-04-01T12:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-sam",
    email: "sam.patel@example.com",
    firstName: "Sam",
    lastName: "Patel",
    displayName: "Sam Patel",
    phone: "+1-206-555-0205",
    role: "member",
    status: "active",
    tier: "student",
    studentIdVerified: true,
    emergencyContactName: "Priya Patel",
    emergencyContactPhone: "+1-206-555-0206",
    emergencyContactRelation: "parent",
    profileComplete: true,
    createdAt: ts("2025-05-10T14:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-riley",
    email: "riley.brooks@example.com",
    firstName: "Riley",
    lastName: "Brooks",
    displayName: "Riley Brooks",
    phone: "+1-206-555-0207",
    role: "member",
    status: "active",
    tier: "daily",
    emergencyContactName: "Taylor Brooks",
    emergencyContactPhone: "+1-206-555-0208",
    emergencyContactRelation: "friend",
    profileComplete: true,
    createdAt: ts("2026-08-20T09:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-nova",
    email: "nova.park@example.com",
    firstName: "Nova",
    lastName: "Park",
    displayName: "Nova Park",
    phone: "+1-206-555-0209",
    role: "member",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Jin Park",
    emergencyContactPhone: "+1-206-555-0210",
    emergencyContactRelation: "spouse",
    profileComplete: true,
    createdAt: ts("2025-07-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-kai",
    email: "kai.nakamura@example.com",
    firstName: "Kai",
    lastName: "Nakamura",
    displayName: "Kai Nakamura",
    phone: "+1-206-555-0211",
    role: "member",
    status: "active",
    tier: "annual",
    emergencyContactName: "Yuri Nakamura",
    emergencyContactPhone: "+1-206-555-0212",
    emergencyContactRelation: "parent",
    profileComplete: true,
    createdAt: ts("2025-06-15T11:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-alex",
    email: "alex.rivera@example.com",
    firstName: "Alex",
    lastName: "Rivera",
    displayName: "Alex Rivera",
    phone: "+1-206-555-0301",
    role: "member",
    status: "lapsed",
    tier: "monthly",
    emergencyContactName: "Maria Rivera",
    emergencyContactPhone: "+1-206-555-0302",
    emergencyContactRelation: "spouse",
    profileComplete: true,
    _notes: "Lapsed membership — payment failed Aug 2026; badge still linked but access should deny user_inactive",
    createdAt: ts("2025-03-01T10:00:00"),
    updatedAt: ts("2026-08-15T09:00:00"),
  },
  {
    id: "u-casey",
    email: "casey.nguyen@example.com",
    firstName: "Casey",
    lastName: "Nguyen",
    displayName: "Casey Nguyen",
    phone: "+1-206-555-0303",
    role: "member",
    status: "suspended",
    tier: "monthly",
    emergencyContactName: "Anh Nguyen",
    emergencyContactPhone: "+1-206-555-0304",
    emergencyContactRelation: "parent",
    profileComplete: true,
    _notes: "Suspended after repeated safety policy violations; staff review pending",
    createdAt: ts("2025-04-20T10:00:00"),
    updatedAt: ts("2026-08-28T16:00:00"),
  },
  {
    id: "u-taylor",
    email: "taylor.kim@example.com",
    firstName: "Taylor",
    lastName: "Kim",
    displayName: "Taylor Kim",
    phone: "+1-206-555-0305",
    role: "member",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Soo Kim",
    emergencyContactPhone: "+1-206-555-0306",
    emergencyContactRelation: "sibling",
    profileComplete: true,
    _notes: "Has expired laser cutter certification — needs refresher checkoff",
    createdAt: ts("2025-02-10T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-morgan",
    email: "morgan.ellis@example.com",
    firstName: "Morgan",
    lastName: "Ellis",
    displayName: "Morgan Ellis",
    phone: "+1-206-555-0307",
    role: "member",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Dana Ellis",
    emergencyContactPhone: "+1-206-555-0308",
    emergencyContactRelation: "partner",
    profileComplete: true,
    _notes: "Passed 3D printing knowledge quiz but has not completed in-person checkoff",
    createdAt: ts("2026-07-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-jamie",
    email: "jamie.ortiz@example.com",
    firstName: "Jamie",
    lastName: "Ortiz",
    displayName: "Jamie Ortiz",
    phone: "+1-206-555-0309",
    role: "member",
    status: "active",
    tier: "annual",
    emergencyContactName: "Luis Ortiz",
    emergencyContactPhone: "+1-206-555-0310",
    emergencyContactRelation: "parent",
    profileComplete: true,
    _notes: "Has outdated waiver (2025.2) — must re-sign current 2026.1 before shop access",
    createdAt: ts("2025-01-20T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-drew",
    email: "drew.santos@example.com",
    firstName: "Drew",
    lastName: "Santos",
    displayName: "Drew Santos",
    phone: "+1-206-555-0311",
    role: "member",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Elena Santos",
    emergencyContactPhone: "+1-206-555-0312",
    emergencyContactRelation: "spouse",
    profileComplete: true,
    _notes: "Has unpaid class booking awaiting_payment with payment hold",
    createdAt: ts("2025-09-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-quinn",
    email: "quinn.walsh@example.com",
    firstName: "Quinn",
    lastName: "Walsh",
    displayName: "Quinn Walsh",
    phone: "+1-206-555-0313",
    role: "member",
    status: "active",
    tier: "monthly",
    emergencyContactName: "Robin Walsh",
    emergencyContactPhone: "+1-206-555-0314",
    emergencyContactRelation: "friend",
    profileComplete: true,
    _notes: "At maxOpenReservations (3) — cannot book more until one completes/cancels",
    createdAt: ts("2025-08-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "u-avery",
    email: "avery.brooks@example.com",
    firstName: "Avery",
    lastName: "Brooks",
    displayName: "Avery Brooks",
    role: "member",
    status: "pending",
    tier: null,
    profileComplete: false,
    _notes: "Pending onboarding — incomplete profile (no phone/emergency contact); for onboarding demo",
    createdAt: ts("2026-09-03T15:00:00"),
    updatedAt: ts("2026-09-03T15:00:00"),
  },
];

// ─── Certifications ──────────────────────────────────────────────────────────
const certifications = [
  {
    id: "cert-shop-orientation",
    slug: "shop-orientation",
    name: "Shop Orientation",
    description: "Required safety and space orientation for all members before using any equipment.",
    knowledgeOnly: true,
    requiresCertificationIds: [],
    expiryMonths: null,
    sortOrder: 1,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-3d-printing",
    slug: "3d-printing",
    name: "3D Printing",
    description: "FDM and resin printer setup, slicing basics, and safe material handling.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 24,
    sortOrder: 2,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-laser-cutter",
    slug: "laser-cutter",
    name: "Laser Cutter",
    description: "CO₂ laser operation, material compatibility, fire safety, and cleanup.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 12,
    sortOrder: 3,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-woodshop-basics",
    slug: "woodshop-basics",
    name: "Woodshop Basics",
    description: "Foundational woodshop safety, PPE, and shared tool etiquette.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 24,
    sortOrder: 4,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-table-saw",
    slug: "table-saw",
    name: "Table Saw",
    description: "Table saw setup, rip/crosscut technique, push sticks, and kickback prevention.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation", "cert-woodshop-basics"],
    expiryMonths: 12,
    sortOrder: 5,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-sewing-machines",
    slug: "sewing-machines",
    name: "Sewing Machines",
    description: "Threading, tension, stitch selection, and safe use of shop sewing machines.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 24,
    sortOrder: 6,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-embroidery-machine",
    slug: "embroidery-machine",
    name: "Embroidery Machine",
    description: "Hooping, digitizing basics, thread paths, and embroidery machine care.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 24,
    sortOrder: 7,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-vinyl-cutter",
    slug: "vinyl-cutter",
    name: "Vinyl Cutter",
    description: "Vinyl cutting, weeding, transfer tape, and cutter maintenance.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 24,
    sortOrder: 8,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "cert-sublimation",
    slug: "sublimation",
    name: "Sublimation",
    description: "Sublimation printer, heat press temperatures, and substrate prep.",
    knowledgeOnly: false,
    requiresCertificationIds: ["cert-shop-orientation"],
    expiryMonths: 24,
    sortOrder: 9,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  },
];

// ─── Machines ────────────────────────────────────────────────────────────────
const machines = [
  {
    id: "m-prusa-mk4",
    name: "Prusa MK4",
    area: "3d_printing",
    requiredCertificationIds: ["cert-3d-printing", "cert-shop-orientation"],
    readerKey: "reader-3d-prusa-mk4",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "3D lab · Station 1",
    gettingStartedVideoUrl: null,
    sortOrder: 1,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-bambu-x1",
    name: "Bambu Lab X1 Carbon",
    area: "3d_printing",
    requiredCertificationIds: ["cert-3d-printing", "cert-shop-orientation"],
    readerKey: "reader-3d-bambu-x1",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "3D lab · Station 2",
    gettingStartedVideoUrl: null,
    sortOrder: 2,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-elegoo-saturn",
    name: "Elegoo Saturn 4 Ultra",
    area: "3d_printing",
    requiredCertificationIds: ["cert-3d-printing", "cert-shop-orientation"],
    readerKey: "reader-3d-elegoo-saturn",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "3D lab · Resin bay",
    gettingStartedVideoUrl: null,
    sortOrder: 3,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-laser-co2",
    name: "OMTech 60W CO₂ Laser",
    area: "laser",
    requiredCertificationIds: ["cert-laser-cutter", "cert-shop-orientation"],
    readerKey: "reader-laser-omtech-60w",
    active: true,
    reservationRecommended: true,
    reservationRequired: true,
    locationLabel: "Laser room · Station 1",
    gettingStartedVideoUrl: null,
    sortOrder: 10,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-table-saw",
    name: "SawStop PCS Table Saw",
    area: "woodshop",
    requiredCertificationIds: ["cert-woodshop-basics", "cert-table-saw", "cert-shop-orientation"],
    readerKey: "reader-wood-tablesaw",
    active: true,
    reservationRecommended: true,
    reservationRequired: true,
    locationLabel: "Woodshop · Bay A",
    gettingStartedVideoUrl: null,
    sortOrder: 20,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-miter-saw",
    name: "Dewalt Sliding Miter Saw",
    area: "woodshop",
    requiredCertificationIds: ["cert-woodshop-basics", "cert-shop-orientation"],
    readerKey: "reader-wood-miter",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Woodshop · Bay B",
    gettingStartedVideoUrl: null,
    sortOrder: 21,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-band-saw",
    name: "Laguna 14″ Band Saw",
    area: "woodshop",
    requiredCertificationIds: ["cert-woodshop-basics", "cert-shop-orientation"],
    readerKey: "reader-wood-bandsaw",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Woodshop · Bay B",
    gettingStartedVideoUrl: null,
    sortOrder: 22,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-planer-jointer",
    name: "Jet Planer/Jointer Combo",
    area: "woodshop",
    requiredCertificationIds: ["cert-woodshop-basics", "cert-shop-orientation"],
    readerKey: "reader-wood-planer",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Woodshop · Bay C",
    gettingStartedVideoUrl: null,
    sortOrder: 23,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-router-table",
    name: "Router Table Station",
    area: "woodshop",
    requiredCertificationIds: ["cert-woodshop-basics", "cert-shop-orientation"],
    readerKey: "reader-wood-router",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Woodshop · Bay C",
    gettingStartedVideoUrl: null,
    sortOrder: 24,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-sewing-1",
    name: "Janome Sewing Machine A",
    area: "textiles_vinyl",
    requiredCertificationIds: ["cert-sewing-machines", "cert-shop-orientation"],
    readerKey: "reader-tex-sewing-a",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Textiles · Sewing row 1",
    gettingStartedVideoUrl: null,
    sortOrder: 30,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-sewing-2",
    name: "Janome Sewing Machine B",
    area: "textiles_vinyl",
    requiredCertificationIds: ["cert-sewing-machines", "cert-shop-orientation"],
    readerKey: "reader-tex-sewing-b",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Textiles · Sewing row 2",
    gettingStartedVideoUrl: null,
    sortOrder: 31,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-embroidery",
    name: "Brother Embroidery PE800",
    area: "textiles_vinyl",
    requiredCertificationIds: ["cert-embroidery-machine", "cert-shop-orientation"],
    readerKey: "reader-tex-embroidery",
    active: true,
    reservationRecommended: true,
    reservationRequired: true,
    locationLabel: "Textiles · Embroidery station",
    gettingStartedVideoUrl: null,
    sortOrder: 32,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-vinyl-cutter",
    name: "Cricut Maker 3",
    area: "textiles_vinyl",
    requiredCertificationIds: ["cert-vinyl-cutter", "cert-shop-orientation"],
    readerKey: "reader-tex-vinyl",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Textiles · Vinyl bench",
    gettingStartedVideoUrl: null,
    sortOrder: 33,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-sub-printer",
    name: "Sawgrass Sublimation Printer",
    area: "sublimation",
    requiredCertificationIds: ["cert-sublimation", "cert-shop-orientation"],
    readerKey: "reader-sub-printer",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Sublimation · Printer desk",
    gettingStartedVideoUrl: null,
    sortOrder: 40,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "m-heat-press",
    name: "Heat Press 15×15",
    area: "sublimation",
    requiredCertificationIds: ["cert-sublimation", "cert-shop-orientation"],
    readerKey: "reader-sub-heatpress",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    locationLabel: "Sublimation · Press table",
    gettingStartedVideoUrl: null,
    sortOrder: 41,
    createdAt: T0,
    updatedAt: NOW,
  },
];

// ─── Badges ──────────────────────────────────────────────────────────────────
const badges = [
  { id: "badge-admin", uid: "a1b2c3d4e5f60718", label: "Staff — Avery", userId: "u-admin", active: true, createdAt: T0, updatedAt: NOW },
  { id: "badge-staff", uid: "b2c3d4e5f6071829", label: "Staff — Sam", userId: "u-staff", active: true, createdAt: T0, updatedAt: NOW },
  { id: "badge-maya", uid: "c3d4e5f60718293a", label: "Maya", userId: "u-maya", active: true, createdAt: ts("2025-03-20T10:00:00"), updatedAt: NOW },
  { id: "badge-jordan", uid: "d4e5f60718293a4b", label: "Jordan", userId: "u-jordan", active: true, createdAt: ts("2025-04-05T10:00:00"), updatedAt: NOW },
  { id: "badge-sam", uid: "e5f60718293a4b5c", label: "Sam P", userId: "u-sam", active: true, createdAt: ts("2025-05-15T10:00:00"), updatedAt: NOW },
  { id: "badge-riley", uid: "f60718293a4b5c6d", label: "Riley day pass", userId: "u-riley", active: true, createdAt: ts("2026-08-20T11:00:00"), updatedAt: NOW },
  { id: "badge-nova", uid: "0718293a4b5c6d7e", label: "Nova", userId: "u-nova", active: true, createdAt: ts("2025-07-05T10:00:00"), updatedAt: NOW },
  { id: "badge-kai", uid: "18293a4b5c6d7e8f", label: "Kai", userId: "u-kai", active: true, createdAt: ts("2025-06-20T10:00:00"), updatedAt: NOW },
  { id: "badge-alex", uid: "293a4b5c6d7e8f90", label: "Alex (lapsed)", userId: "u-alex", active: true, createdAt: ts("2025-03-05T10:00:00"), updatedAt: NOW },
  { id: "badge-casey", uid: "3a4b5c6d7e8f9012", label: "Casey (suspended)", userId: "u-casey", active: false, createdAt: ts("2025-04-25T10:00:00"), updatedAt: ts("2026-08-28T16:00:00") },
  { id: "badge-taylor", uid: "4b5c6d7e8f901234", label: "Taylor", userId: "u-taylor", active: true, createdAt: ts("2025-02-15T10:00:00"), updatedAt: NOW },
  { id: "badge-morgan", uid: "5c6d7e8f90123456", label: "Morgan", userId: "u-morgan", active: true, createdAt: ts("2026-07-05T10:00:00"), updatedAt: NOW },
  { id: "badge-jamie", uid: "6d7e8f9012345678", label: "Jamie", userId: "u-jamie", active: true, createdAt: ts("2025-01-25T10:00:00"), updatedAt: NOW },
  { id: "badge-drew", uid: "7e8f90123456789a", label: "Drew", userId: "u-drew", active: true, createdAt: ts("2025-09-05T10:00:00"), updatedAt: NOW },
  { id: "badge-quinn", uid: "8f90123456789abc", label: "Quinn", userId: "u-quinn", active: true, createdAt: ts("2025-08-05T10:00:00"), updatedAt: NOW },
  { id: "badge-inventory-01", uid: "90123456789abcde", label: "Spare badge #1", userId: null, active: true, createdAt: ts("2026-01-10T10:00:00"), updatedAt: NOW },
];

function uc(id, userId, certificationId, status, extras = {}) {
  return {
    id,
    userId,
    certificationId,
    status,
    knowledgePassedAt: extras.knowledgePassedAt ?? null,
    checkedOffAt: extras.checkedOffAt ?? null,
    checkedOffById: extras.checkedOffById ?? null,
    expiresAt: extras.expiresAt ?? null,
    revokedAt: extras.revokedAt ?? null,
    revokedById: extras.revokedById ?? null,
    revokeReason: extras.revokeReason ?? null,
    createdAt: extras.createdAt ?? T0,
    updatedAt: extras.updatedAt ?? NOW,
  };
}

const userCertifications = [
  // Admin & staff — fully certified
  uc("uc-admin-orient", "u-admin", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-01-12T10:00:00"), checkedOffAt: ts("2025-01-12T10:00:00"), checkedOffById: "u-admin" }),
  uc("uc-admin-3d", "u-admin", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-01-15T10:00:00"), checkedOffAt: ts("2025-01-16T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-01-16T10:00:00") }),
  uc("uc-admin-laser", "u-admin", "cert-laser-cutter", "certified", { knowledgePassedAt: ts("2025-01-15T10:00:00"), checkedOffAt: ts("2025-01-16T11:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-01-16T11:00:00") }),
  uc("uc-admin-wood", "u-admin", "cert-woodshop-basics", "certified", { knowledgePassedAt: ts("2025-01-15T10:00:00"), checkedOffAt: ts("2025-01-17T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-01-17T10:00:00") }),
  uc("uc-admin-tablesaw", "u-admin", "cert-table-saw", "certified", { knowledgePassedAt: ts("2025-01-18T10:00:00"), checkedOffAt: ts("2025-01-18T14:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-01-18T14:00:00") }),
  uc("uc-staff-orient", "u-staff", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-02-05T10:00:00"), checkedOffAt: ts("2025-02-05T10:00:00"), checkedOffById: "u-admin" }),
  uc("uc-staff-3d", "u-staff", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-02-10T10:00:00"), checkedOffAt: ts("2025-02-11T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-02-11T10:00:00") }),
  uc("uc-staff-laser", "u-staff", "cert-laser-cutter", "certified", { knowledgePassedAt: ts("2025-02-10T10:00:00"), checkedOffAt: ts("2025-02-12T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-02-12T10:00:00") }),
  uc("uc-staff-wood", "u-staff", "cert-woodshop-basics", "certified", { knowledgePassedAt: ts("2025-02-10T10:00:00"), checkedOffAt: ts("2025-02-13T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-02-13T10:00:00") }),
  uc("uc-staff-tablesaw", "u-staff", "cert-table-saw", "certified", { knowledgePassedAt: ts("2025-02-14T10:00:00"), checkedOffAt: ts("2025-02-14T14:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-02-14T14:00:00") }),
  uc("uc-staff-sew", "u-staff", "cert-sewing-machines", "certified", { knowledgePassedAt: ts("2025-03-01T10:00:00"), checkedOffAt: ts("2025-03-02T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-03-02T10:00:00") }),
  uc("uc-staff-emb", "u-staff", "cert-embroidery-machine", "certified", { knowledgePassedAt: ts("2025-03-01T10:00:00"), checkedOffAt: ts("2025-03-03T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-03-03T10:00:00") }),
  uc("uc-staff-vinyl", "u-staff", "cert-vinyl-cutter", "certified", { knowledgePassedAt: ts("2025-03-01T10:00:00"), checkedOffAt: ts("2025-03-04T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-03-04T10:00:00") }),
  uc("uc-staff-sub", "u-staff", "cert-sublimation", "certified", { knowledgePassedAt: ts("2025-03-01T10:00:00"), checkedOffAt: ts("2025-03-05T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-03-05T10:00:00") }),

  // Maya — power user
  uc("uc-maya-orient", "u-maya", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-03-18T10:00:00"), checkedOffAt: ts("2025-03-18T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-maya-3d", "u-maya", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-03-25T10:00:00"), checkedOffAt: ts("2025-03-28T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-03-28T10:00:00") }),
  uc("uc-maya-laser", "u-maya", "cert-laser-cutter", "certified", { knowledgePassedAt: ts("2025-04-10T10:00:00"), checkedOffAt: ts("2025-04-12T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-04-12T10:00:00") }),
  uc("uc-maya-wood", "u-maya", "cert-woodshop-basics", "certified", { knowledgePassedAt: ts("2025-05-01T10:00:00"), checkedOffAt: ts("2025-05-03T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-05-03T10:00:00") }),
  uc("uc-maya-tablesaw", "u-maya", "cert-table-saw", "certified", { knowledgePassedAt: ts("2025-05-10T10:00:00"), checkedOffAt: ts("2025-05-12T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-05-12T10:00:00") }),

  // Jordan
  uc("uc-jordan-orient", "u-jordan", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-04-05T10:00:00"), checkedOffAt: ts("2025-04-05T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-jordan-3d", "u-jordan", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-04-15T10:00:00"), checkedOffAt: ts("2025-04-18T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-04-18T10:00:00") }),
  uc("uc-jordan-vinyl", "u-jordan", "cert-vinyl-cutter", "certified", { knowledgePassedAt: ts("2025-06-01T10:00:00"), checkedOffAt: ts("2025-06-03T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-06-03T10:00:00") }),
  uc("uc-jordan-sub", "u-jordan", "cert-sublimation", "certified", { knowledgePassedAt: ts("2025-06-10T10:00:00"), checkedOffAt: ts("2025-06-12T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-06-12T10:00:00") }),

  // Sam (student)
  uc("uc-sam-orient", "u-sam", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-05-12T10:00:00"), checkedOffAt: ts("2025-05-12T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-sam-3d", "u-sam", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-05-20T10:00:00"), checkedOffAt: ts("2025-05-22T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-05-22T10:00:00") }),
  uc("uc-sam-sew", "u-sam", "cert-sewing-machines", "not_started"),

  // Riley (day pass — orientation only)
  uc("uc-riley-orient", "u-riley", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2026-08-20T14:00:00"), checkedOffAt: ts("2026-08-20T14:00:00"), checkedOffById: "u-staff" }),

  // Nova — textiles
  uc("uc-nova-orient", "u-nova", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-07-05T10:00:00"), checkedOffAt: ts("2025-07-05T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-nova-sew", "u-nova", "cert-sewing-machines", "certified", { knowledgePassedAt: ts("2025-07-12T10:00:00"), checkedOffAt: ts("2025-07-14T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-07-14T10:00:00") }),
  uc("uc-nova-emb", "u-nova", "cert-embroidery-machine", "certified", { knowledgePassedAt: ts("2025-07-20T10:00:00"), checkedOffAt: ts("2025-07-22T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-07-22T10:00:00") }),
  uc("uc-nova-vinyl", "u-nova", "cert-vinyl-cutter", "certified", { knowledgePassedAt: ts("2025-08-01T10:00:00"), checkedOffAt: ts("2025-08-03T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-08-03T10:00:00") }),

  // Kai — woodshop
  uc("uc-kai-orient", "u-kai", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-06-18T10:00:00"), checkedOffAt: ts("2025-06-18T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-kai-wood", "u-kai", "cert-woodshop-basics", "certified", { knowledgePassedAt: ts("2025-06-25T10:00:00"), checkedOffAt: ts("2025-06-27T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-06-27T10:00:00") }),
  uc("uc-kai-tablesaw", "u-kai", "cert-table-saw", "certified", { knowledgePassedAt: ts("2025-07-05T10:00:00"), checkedOffAt: ts("2025-07-08T10:00:00"), checkedOffById: "u-admin", expiresAt: ts("2027-07-08T10:00:00") }),
  uc("uc-kai-laser", "u-kai", "cert-laser-cutter", "knowledge_passed", { knowledgePassedAt: ts("2026-08-01T10:00:00") }),

  // Alex lapsed — still has certs on record
  uc("uc-alex-orient", "u-alex", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-03-05T10:00:00"), checkedOffAt: ts("2025-03-05T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-alex-3d", "u-alex", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-03-10T10:00:00"), checkedOffAt: ts("2025-03-12T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-03-12T10:00:00") }),

  // Casey suspended — revoked laser
  uc("uc-casey-orient", "u-casey", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-04-22T10:00:00"), checkedOffAt: ts("2025-04-22T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-casey-laser", "u-casey", "cert-laser-cutter", "revoked", {
    knowledgePassedAt: ts("2025-05-01T10:00:00"),
    checkedOffAt: ts("2025-05-03T10:00:00"),
    checkedOffById: "u-staff",
    revokedAt: ts("2026-08-28T16:00:00"),
    revokedById: "u-admin",
    revokeReason: "Unsafe laser operation — left unattended while cutting",
  }),

  // Taylor — expired laser
  uc("uc-taylor-orient", "u-taylor", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-02-12T10:00:00"), checkedOffAt: ts("2025-02-12T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-taylor-laser", "u-taylor", "cert-laser-cutter", "expired", {
    knowledgePassedAt: ts("2025-03-01T10:00:00"),
    checkedOffAt: ts("2025-03-05T10:00:00"),
    checkedOffById: "u-staff",
    expiresAt: ts("2026-03-05T10:00:00"),
  }),
  uc("uc-taylor-3d", "u-taylor", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-03-10T10:00:00"), checkedOffAt: ts("2025-03-12T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-03-12T10:00:00") }),

  // Morgan — knowledge_passed, no checkoff
  uc("uc-morgan-orient", "u-morgan", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2026-07-03T10:00:00"), checkedOffAt: ts("2026-07-03T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-morgan-3d", "u-morgan", "cert-3d-printing", "knowledge_passed", { knowledgePassedAt: ts("2026-08-15T14:30:00") }),

  // Jamie — orientation certified, outdated waiver separately
  uc("uc-jamie-orient", "u-jamie", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-01-22T10:00:00"), checkedOffAt: ts("2025-01-22T10:00:00"), checkedOffById: "u-admin" }),
  uc("uc-jamie-wood", "u-jamie", "cert-woodshop-basics", "certified", { knowledgePassedAt: ts("2025-02-01T10:00:00"), checkedOffAt: ts("2025-02-05T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-02-05T10:00:00") }),

  // Drew
  uc("uc-drew-orient", "u-drew", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-09-05T10:00:00"), checkedOffAt: ts("2025-09-05T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-drew-3d", "u-drew", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-09-15T10:00:00"), checkedOffAt: ts("2025-09-18T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-09-18T10:00:00") }),

  // Quinn
  uc("uc-quinn-orient", "u-quinn", "cert-shop-orientation", "certified", { knowledgePassedAt: ts("2025-08-05T10:00:00"), checkedOffAt: ts("2025-08-05T10:00:00"), checkedOffById: "u-staff" }),
  uc("uc-quinn-3d", "u-quinn", "cert-3d-printing", "certified", { knowledgePassedAt: ts("2025-08-12T10:00:00"), checkedOffAt: ts("2025-08-14T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-08-14T10:00:00") }),
  uc("uc-quinn-laser", "u-quinn", "cert-laser-cutter", "certified", { knowledgePassedAt: ts("2025-08-20T10:00:00"), checkedOffAt: ts("2025-08-22T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-08-22T10:00:00") }),
  uc("uc-quinn-wood", "u-quinn", "cert-woodshop-basics", "certified", { knowledgePassedAt: ts("2025-09-01T10:00:00"), checkedOffAt: ts("2025-09-03T10:00:00"), checkedOffById: "u-staff", expiresAt: ts("2027-09-03T10:00:00") }),
];

// ─── Settings ────────────────────────────────────────────────────────────────
const settings = {
  orgName: "The Box · Discover Burien Makerspace",
  paymentUrl: "https://www.zeffy.com/en-US/donation-form/example-the-box",
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
  updatedAt: NOW,
};

// ─── Content pages + markdown ────────────────────────────────────────────────
const contentDefs = [
  {
    id: "content-waiver",
    slug: "waiver",
    title: "Liability Waiver & Assumption of Risk",
    category: "waiver",
    version: "2026.1",
    markdownPath: "content/waiver.md",
    paragraphs: [
      "By signing this waiver, you acknowledge that use of The Box makerspace involves inherent risks including injury from tools, equipment, materials, and other members.",
      "You agree to follow all posted safety rules, complete required orientations and certifications before using equipment, and accept full responsibility for your projects and personal belongings.",
      "You release Discover Burien and The Box staff, volunteers, and affiliates from liability to the fullest extent permitted by law, except for gross negligence or willful misconduct.",
      "This waiver (version 2026.1) remains in effect until superseded by a newer published version that you must re-sign.",
    ],
  },
  {
    id: "content-hours",
    slug: "hours",
    title: "Hours of Operation",
    category: "hours",
    version: "2026.1",
    markdownPath: "content/hours/hours.md",
    paragraphs: [
      "Open studio hours: Tuesday–Thursday 4:00–8:00 PM, Saturday 10:00 AM–4:00 PM.",
      "Staffed orientation and checkoff appointments are available by reservation during open hours.",
      "Holiday closures and special events are posted on the Discover Burien calendar and at the shop entrance.",
    ],
  },
  {
    id: "content-member-expectations",
    slug: "member-expectations",
    title: "Member Expectations",
    category: "policy",
    version: "2026.1",
    markdownPath: "content/policies/member-expectations.md",
    paragraphs: [
      "Members treat people, tools, and the space with respect. Clean your station, return tools, and leave the shop better than you found it.",
      "Never use equipment you are not certified for. Ask staff when unsure. Report damaged tools immediately.",
      "Harassment, discrimination, and unsafe behavior are grounds for suspension or revocation of membership.",
    ],
  },
  {
    id: "content-storage",
    slug: "storage-abandoned-property",
    title: "Storage & Abandoned Property",
    category: "policy",
    version: "2025.4",
    markdownPath: "content/policies/storage-abandoned-property.md",
    paragraphs: [
      "Short-term project storage is available in labeled member cubbies during active projects (up to 14 days).",
      "Items left beyond the labeled date or after membership lapses may be treated as abandoned and donated or discarded after 30 days notice.",
      "The Box is not responsible for lost, stolen, or damaged personal property.",
    ],
  },
  {
    id: "content-guests",
    slug: "guests-and-minors",
    title: "Guests & Minors",
    category: "policy",
    version: "2025.4",
    markdownPath: "content/policies/guests-and-minors.md",
    paragraphs: [
      "Adult guests may visit during open hours with a member host and must sign a day waiver at the front desk.",
      "TODO: Confirm age thresholds, guardian requirements, and which machines are off-limits to minors under 16. Legal review pending before publish.",
      "Minors must be accompanied by a guardian who remains on-site unless enrolled in a staffed youth program.",
    ],
  },
  {
    id: "content-volunteering",
    slug: "volunteering",
    title: "Volunteering at The Box",
    category: "policy",
    version: "2025.4",
    markdownPath: "content/policies/volunteering.md",
    paragraphs: [
      "Volunteers help with open hours, orientations, tool maintenance, and community events.",
      "All volunteers complete Shop Orientation and a short onboarding with staff before unsupervised shifts.",
      "Express interest through the volunteer form; staff will follow up within about one week.",
    ],
  },
  {
    id: "content-faq",
    slug: "faq",
    title: "Frequently Asked Questions",
    category: "faq",
    version: "2026.1",
    markdownPath: "content/policies/faq.md",
    paragraphs: [
      "Do I need a membership to take a class? Many workshops are open to the public; membership discounts may apply.",
      "How do certifications work? Complete the knowledge module, then book an in-person checkoff with staff.",
      "Can I reserve machines? Yes — high-demand tools like the laser and table saw recommend reservations.",
    ],
  },
  {
    id: "content-vol-front-desk",
    slug: "volunteer-front-desk",
    title: "Front Desk Greeter",
    category: "volunteer",
    version: "2026.1",
    markdownPath: "content/volunteer/front-desk.md",
    paragraphs: [
      "Welcome members, check waivers, and help newcomers find orientations and class check-in.",
      "Ideal for friendly communicators who know (or want to learn) the shop layout.",
    ],
  },
  {
    id: "content-vol-shop-steward",
    slug: "volunteer-shop-steward",
    title: "Shop Steward",
    category: "volunteer",
    version: "2026.1",
    markdownPath: "content/volunteer/shop-steward.md",
    paragraphs: [
      "Support open hours by answering tool questions, enforcing PPE, and keeping stations tidy.",
      "Requires Shop Orientation plus at least one area certification.",
    ],
  },
  {
    id: "content-vol-events",
    slug: "volunteer-events",
    title: "Events & Outreach Helper",
    category: "volunteer",
    version: "2026.1",
    markdownPath: "content/volunteer/events.md",
    paragraphs: [
      "Help set up community make-nights, tabling at Discover Burien events, and post-event cleanup.",
      "Flexible evening and weekend shifts; no machine certifications required.",
    ],
  },
  // Class blurbs
  {
    id: "content-class-shop-orient",
    slug: "class-shop-orientation",
    title: "Shop Orientation Class",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/shop-orientation.md",
    paragraphs: [
      "A guided walkthrough of The Box: safety culture, PPE, emergency exits, and how certifications work.",
      "Required before independent machine use. About 90 minutes including Q&A.",
    ],
  },
  {
    id: "content-class-3d-intro",
    slug: "class-3d-printing-intro",
    title: "Intro to 3D Printing",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/3d-printing-intro.md",
    paragraphs: [
      "Learn FDM basics: slicing, bed leveling concepts, filament handling, and first print workflow on our Prusa printers.",
      "Completing this workshop counts toward the knowledge portion of the 3D Printing certification.",
    ],
  },
  {
    id: "content-class-laser",
    slug: "class-laser-basics",
    title: "Laser Cutter Basics",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/laser-basics.md",
    paragraphs: [
      "Material selection, file prep, focus, and fire-watch habits on the CO₂ laser.",
      "Prerequisite: Shop Orientation. Checkoff available after the session for eligible members.",
    ],
  },
  {
    id: "content-class-wood",
    slug: "class-woodshop-safety",
    title: "Woodshop Safety & Basics",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/woodshop-safety.md",
    paragraphs: [
      "PPE, dust collection, and safe use of miter saw, band saw, and planer/jointer stations.",
      "Table saw certification is a separate checkoff after this basics course.",
    ],
  },
  {
    id: "content-class-sewing",
    slug: "class-sewing-basics",
    title: "Sewing Machine Basics",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/sewing-basics.md",
    paragraphs: [
      "Threading, bobbins, tension, and straight-stitch confidence on our Janome machines.",
      "Bring a simple project idea; fabric scraps provided.",
    ],
  },
  {
    id: "content-class-open-studio",
    slug: "class-open-studio-night",
    title: "Open Studio Night",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/open-studio-night.md",
    paragraphs: [
      "Staffed open hours for certified members to work on personal projects with peer support.",
      "Free for active members. Bring your own materials unless otherwise noted.",
    ],
  },
  {
    id: "content-class-embroidery",
    slug: "class-embroidery-intro",
    title: "Embroidery Machine Intro",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/embroidery-intro.md",
    paragraphs: [
      "Hooping, design transfer, and first stitch-outs on the Brother PE800.",
      "Great follow-on after sewing basics.",
    ],
  },
  {
    id: "content-class-sublimation",
    slug: "class-sublimation-workshop",
    title: "Sublimation Workshop",
    category: "class",
    version: "2026.1",
    markdownPath: "content/classes/sublimation-workshop.md",
    paragraphs: [
      "Print, press, and peel: mugs, shirts, and hard blanks with our Sawgrass + heat press setup.",
      "Materials fee included for one blank of your choice.",
    ],
  },
  // Lessons
  {
    id: "content-lesson-so-1",
    slug: "lesson-shop-orientation-welcome",
    title: "Welcome to The Box",
    category: "lesson",
    version: "2026.1",
    markdownPath: "content/lessons/shop-orientation/welcome.md",
    paragraphs: [
      "The Box is Discover Burien’s community makerspace. This lesson covers who we serve, how membership works, and what “leave it better” means in practice.",
      "You will learn where to find staff, first aid, fire extinguishers, and the emergency exit nearest the woodshop.",
    ],
  },
  {
    id: "content-lesson-so-2",
    slug: "lesson-shop-orientation-safety",
    title: "Safety Culture & PPE",
    category: "lesson",
    version: "2026.1",
    markdownPath: "content/lessons/shop-orientation/safety.md",
    paragraphs: [
      "Eye and ear protection, closed-toe shoes, and hair/jewelry rules apply in active shop areas.",
      "Never interrupt someone mid-cut. Use the buddy system for high-risk tools and stop work if something feels unsafe.",
    ],
  },
  {
    id: "content-lesson-so-3",
    slug: "lesson-shop-orientation-access",
    title: "Badges, Certs & Reservations",
    category: "lesson",
    version: "2026.1",
    markdownPath: "content/lessons/shop-orientation/access.md",
    paragraphs: [
      "Badge readers gate powered equipment. Your badge only unlocks machines you are certified for.",
      "Reserve high-demand tools, cancel early when plans change, and never share badges.",
    ],
  },
  {
    id: "content-lesson-3d-1",
    slug: "lesson-3d-slicing",
    title: "Slicing Basics",
    category: "lesson",
    version: "2026.1",
    markdownPath: "content/lessons/3d-printing/slicing.md",
    paragraphs: [
      "Slicers convert STL/3MF models into G-code. Learn profiles, layer height, supports, and bed adhesion settings used on our Prusa and Bambu printers.",
      "Always preview toolpaths before sending a job and confirm filament type matches the profile.",
    ],
  },
  {
    id: "content-lesson-3d-2",
    slug: "lesson-3d-materials",
    title: "Materials & Bed Prep",
    category: "lesson",
    version: "2026.1",
    markdownPath: "content/lessons/3d-printing/materials.md",
    paragraphs: [
      "PLA is the shop default. PETG and specialty filaments need approved profiles and sometimes an enclosure.",
      "Clean the bed, check first-layer squish, and never leave resin printers unattended during print or wash/cure.",
    ],
  },
  {
    id: "content-lesson-3d-3",
    slug: "lesson-3d-troubleshooting",
    title: "Troubleshooting & Cleanup",
    category: "lesson",
    version: "2026.1",
    markdownPath: "content/lessons/3d-printing/troubleshooting.md",
    paragraphs: [
      "Common issues: warping, stringing, nozzle clogs, and failed first layers. Pause safely, ask staff before disassembling hotends.",
      "Remove failed prints, scrape residue carefully, and log filament usage and any faults in the shop notebook.",
    ],
  },
];

const contentPages = contentDefs.map((d) => {
  writeMd(d.markdownPath.replace(/^content\//, ""), mdParas(...d.paragraphs));
  return {
    id: d.id,
    notionId: null,
    slug: d.slug,
    title: d.title,
    html: para(...d.paragraphs),
    markdownPath: d.markdownPath,
    category: d.category,
    version: d.version,
    syncedAt: ts("2026-09-01T09:00:00"),
    published: true,
    createdAt: T0,
    updatedAt: NOW,
  };
});

// ─── Learning modules / lessons / questions ──────────────────────────────────
const learningModules = [
  {
    id: "mod-shop-orientation",
    slug: "shop-orientation",
    title: "Shop Orientation",
    summary: "Safety, culture, and access rules for The Box makerspace.",
    certificationId: "cert-shop-orientation",
    knowledgeOnly: true,
    published: true,
    passThresholdPercent: 80,
    attemptLimit: 3,
    sortOrder: 1,
    createdAt: T0,
    updatedAt: NOW,
  },
  {
    id: "mod-3d-printing",
    slug: "3d-printing",
    title: "3D Printing Knowledge",
    summary: "FDM/resin workflows, materials, and shop printer etiquette.",
    certificationId: "cert-3d-printing",
    knowledgeOnly: false,
    published: true,
    passThresholdPercent: 80,
    attemptLimit: 3,
    sortOrder: 2,
    createdAt: T0,
    updatedAt: NOW,
  },
];

const lessons = [
  { id: "lesson-so-1", moduleId: "mod-shop-orientation", slug: "welcome", title: "Welcome to The Box", contentSlug: "lesson-shop-orientation-welcome", sortOrder: 1, estimatedMinutes: 8, createdAt: T0, updatedAt: NOW },
  { id: "lesson-so-2", moduleId: "mod-shop-orientation", slug: "safety", title: "Safety Culture & PPE", contentSlug: "lesson-shop-orientation-safety", sortOrder: 2, estimatedMinutes: 12, createdAt: T0, updatedAt: NOW },
  { id: "lesson-so-3", moduleId: "mod-shop-orientation", slug: "access", title: "Badges, Certs & Reservations", contentSlug: "lesson-shop-orientation-access", sortOrder: 3, estimatedMinutes: 10, createdAt: T0, updatedAt: NOW },
  { id: "lesson-3d-1", moduleId: "mod-3d-printing", slug: "slicing", title: "Slicing Basics", contentSlug: "lesson-3d-slicing", sortOrder: 1, estimatedMinutes: 15, createdAt: T0, updatedAt: NOW },
  { id: "lesson-3d-2", moduleId: "mod-3d-printing", slug: "materials", title: "Materials & Bed Prep", contentSlug: "lesson-3d-materials", sortOrder: 2, estimatedMinutes: 12, createdAt: T0, updatedAt: NOW },
  { id: "lesson-3d-3", moduleId: "mod-3d-printing", slug: "troubleshooting", title: "Troubleshooting & Cleanup", contentSlug: "lesson-3d-troubleshooting", sortOrder: 3, estimatedMinutes: 14, createdAt: T0, updatedAt: NOW },
];

function makeQuestions(moduleId, prefix, items) {
  return items.map((item, i) => ({
    id: `${prefix}-q${String(i + 1).padStart(2, "0")}`,
    moduleId,
    prompt: item.prompt,
    choices: item.choices,
    correctIndex: item.correctIndex,
    explanation: item.explanation,
    active: true,
    createdAt: T0,
    updatedAt: NOW,
  }));
}

const shopQuestions = makeQuestions("mod-shop-orientation", "q-so", [
  { prompt: "What footwear is required in active shop areas?", choices: ["Closed-toe shoes", "Sandals OK if careful", "Barefoot for grip", "Heels for posture"], correctIndex: 0, explanation: "Closed-toe shoes protect against dropped tools and debris." },
  { prompt: "When may you use a machine?", choices: ["Only after required certifications", "Whenever the shop is open", "If a friend shows you once", "After watching a YouTube video"], correctIndex: 0, explanation: "Certifications gate powered equipment." },
  { prompt: "What should you do if a tool is damaged?", choices: ["Report it to staff immediately", "Hide it and keep working", "Try to repair it yourself first", "Leave a sticky note only"], correctIndex: 0 },
  { prompt: "Sharing your access badge is:", choices: ["Never allowed", "OK with close friends", "OK if staff are busy", "Required for guests"], correctIndex: 0 },
  { prompt: "Eye protection is required when:", choices: ["Using tools that can throw debris", "Only in the woodshop", "Only if you wear contacts", "Never — glasses are enough"], correctIndex: 0 },
  { prompt: "The member expectation “leave it better” means:", choices: ["Clean your station and put tools away", "Leave projects on every bench", "Take extra consumables home", "Ignore dust collection"], correctIndex: 0 },
  { prompt: "Reservations are recommended for:", choices: ["High-demand tools like the laser", "Every hand tool", "Only 3D printers", "Never — first come first served"], correctIndex: 0 },
  { prompt: "If you are unsure how to use a tool:", choices: ["Ask staff or stop and look up the cert module", "Guess based on similar tools", "Let a guest try first", "Disable safety features temporarily"], correctIndex: 0 },
  { prompt: "Emergency exits should be:", choices: ["Kept clear at all times", "Used for storage of long lumber", "Blocked during events", "Only for staff"], correctIndex: 0 },
  { prompt: "Guests in the shop must:", choices: ["Sign a day waiver and stay with a host", "Borrow a member badge", "Use any machine freely", "Skip orientation"], correctIndex: 0 },
  { prompt: "PPE stands for:", choices: ["Personal Protective Equipment", "Public Printer Etiquette", "Preferred Project Entry", "Power Panel Enclosure"], correctIndex: 0 },
  { prompt: "Before leaving the shop you should:", choices: ["Power down tools you used and clean up", "Leave machines running for the next person", "Store wet brushes on the laser bed", "Unplug the main breaker"], correctIndex: 0 },
  { prompt: "Harassment of other members results in:", choices: ["Possible suspension or revocation", "A free class credit", "Automatic upgrade to annual", "No consequences"], correctIndex: 0 },
  { prompt: "Knowledge-only certifications still require:", choices: ["Passing the quiz (and any listed lessons)", "No learning at all", "Only a cash deposit", "A notarized letter"], correctIndex: 0 },
  { prompt: "The Box is operated by:", choices: ["Discover Burien", "A private for-profit chain", "The city fire department alone", "Amazon"], correctIndex: 0 },
]);

const print3dQuestions = makeQuestions("mod-3d-printing", "q-3d", [
  { prompt: "What does a slicer produce for FDM printers?", choices: ["G-code toolpaths", "STL meshes only", "PNG textures", "DXF outlines"], correctIndex: 0 },
  { prompt: "Shop default filament for beginners is:", choices: ["PLA", "ABS only", "Nylon CF", "Polycarbonate"], correctIndex: 0 },
  { prompt: "Before starting a print you should:", choices: ["Preview the slice and confirm the profile", "Skip bed cleaning", "Disable endstops", "Override nozzle temp to max"], correctIndex: 0 },
  { prompt: "Resin printers require:", choices: ["PPE and careful wash/cure handling", "No gloves", "Open food nearby", "Unattended overnight curing in the lobby"], correctIndex: 0 },
  { prompt: "A common cause of first-layer failure is:", choices: ["Incorrect bed leveling / Z offset", "Too much ear protection", "Using PLA", "Room lights on"], correctIndex: 0 },
  { prompt: "Supports are used to:", choices: ["Hold overhangs during printing", "Cool the nozzle faster", "Increase bed adhesion only", "Replace brims"], correctIndex: 0 },
  { prompt: "If a print fails mid-job:", choices: ["Pause safely and ask staff if unsure", "Yank the bed while hot", "Cut the heater wires", "Ignore smoke"], correctIndex: 0 },
  { prompt: "PETG compared to PLA typically needs:", choices: ["Different temps and sometimes an enclosure", "Lower adhesion always", "No profile change", "Water as lubricant"], correctIndex: 0 },
  { prompt: "After printing you should:", choices: ["Remove debris and log issues", "Leave failed rafts for staff forever", "Store scrap on the laser", "Reset all printers to factory"], correctIndex: 0 },
  { prompt: "Badge access to printers requires:", choices: ["3D Printing cert + Shop Orientation", "Only annual membership", "A woodshop cert", "No certifications"], correctIndex: 0 },
  { prompt: "Stringing is often reduced by:", choices: ["Tuning retraction and temperatures", "Printing underwater", "Removing the part cooling fan forever", "Doubling layer height to 2mm"], correctIndex: 0 },
  { prompt: "Never leave a resin print:", choices: ["Unattended during critical wash/cure steps without following shop rules", "In the UV cure station with a timer", "Labeled on the drying rack", "Documented in the log"], correctIndex: 0 },
  { prompt: "Bed adhesion aids may include:", choices: ["Clean surface, glue stick, or textured PEI as appropriate", "Motor oil", "Duct tape on the nozzle", "Wet paper towels under the bed"], correctIndex: 0 },
  { prompt: "Changing filament mid-spool requires:", choices: ["Following the printer’s unload/load procedure", "Forcing filament past a cold nozzle", "Cutting the hotend thermistor", "Ignoring material type"], correctIndex: 0 },
  { prompt: "Knowledge pass for 3D printing still requires:", choices: ["An in-person checkoff before certified status", "Nothing else ever", "Only a waiver", "Buying a printer"], correctIndex: 0 },
]);

const questions = [...shopQuestions, ...print3dQuestions];

const lessonProgress = [
  { id: "lp-maya-so-1", userId: "u-maya", lessonId: "lesson-so-1", completedAt: ts("2025-03-18T09:00:00"), createdAt: ts("2025-03-18T09:00:00"), updatedAt: ts("2025-03-18T09:00:00") },
  { id: "lp-maya-so-2", userId: "u-maya", lessonId: "lesson-so-2", completedAt: ts("2025-03-18T09:20:00"), createdAt: ts("2025-03-18T09:20:00"), updatedAt: ts("2025-03-18T09:20:00") },
  { id: "lp-maya-so-3", userId: "u-maya", lessonId: "lesson-so-3", completedAt: ts("2025-03-18T09:40:00"), createdAt: ts("2025-03-18T09:40:00"), updatedAt: ts("2025-03-18T09:40:00") },
  { id: "lp-maya-3d-1", userId: "u-maya", lessonId: "lesson-3d-1", completedAt: ts("2025-03-25T10:00:00"), createdAt: ts("2025-03-25T10:00:00"), updatedAt: ts("2025-03-25T10:00:00") },
  { id: "lp-maya-3d-2", userId: "u-maya", lessonId: "lesson-3d-2", completedAt: ts("2025-03-25T10:30:00"), createdAt: ts("2025-03-25T10:30:00"), updatedAt: ts("2025-03-25T10:30:00") },
  { id: "lp-maya-3d-3", userId: "u-maya", lessonId: "lesson-3d-3", completedAt: ts("2025-03-25T11:00:00"), createdAt: ts("2025-03-25T11:00:00"), updatedAt: ts("2025-03-25T11:00:00") },
  { id: "lp-morgan-so-1", userId: "u-morgan", lessonId: "lesson-so-1", completedAt: ts("2026-07-02T18:00:00"), createdAt: ts("2026-07-02T18:00:00"), updatedAt: ts("2026-07-02T18:00:00") },
  { id: "lp-morgan-so-2", userId: "u-morgan", lessonId: "lesson-so-2", completedAt: ts("2026-07-02T18:20:00"), createdAt: ts("2026-07-02T18:20:00"), updatedAt: ts("2026-07-02T18:20:00") },
  { id: "lp-morgan-so-3", userId: "u-morgan", lessonId: "lesson-so-3", completedAt: ts("2026-07-02T18:40:00"), createdAt: ts("2026-07-02T18:40:00"), updatedAt: ts("2026-07-02T18:40:00") },
  { id: "lp-morgan-3d-1", userId: "u-morgan", lessonId: "lesson-3d-1", completedAt: ts("2026-08-14T17:00:00"), createdAt: ts("2026-08-14T17:00:00"), updatedAt: ts("2026-08-14T17:00:00") },
  { id: "lp-morgan-3d-2", userId: "u-morgan", lessonId: "lesson-3d-2", completedAt: ts("2026-08-14T17:30:00"), createdAt: ts("2026-08-14T17:30:00"), updatedAt: ts("2026-08-14T17:30:00") },
  { id: "lp-morgan-3d-3", userId: "u-morgan", lessonId: "lesson-3d-3", completedAt: ts("2026-08-15T10:00:00"), createdAt: ts("2026-08-15T10:00:00"), updatedAt: ts("2026-08-15T10:00:00") },
  { id: "lp-sam-so-1", userId: "u-sam", lessonId: "lesson-so-1", completedAt: ts("2025-05-12T09:00:00"), createdAt: ts("2025-05-12T09:00:00"), updatedAt: ts("2025-05-12T09:00:00") },
  { id: "lp-sam-so-2", userId: "u-sam", lessonId: "lesson-so-2", completedAt: ts("2025-05-12T09:20:00"), createdAt: ts("2025-05-12T09:20:00"), updatedAt: ts("2025-05-12T09:20:00") },
  { id: "lp-sam-so-3", userId: "u-sam", lessonId: "lesson-so-3", completedAt: ts("2025-05-12T09:40:00"), createdAt: ts("2025-05-12T09:40:00"), updatedAt: ts("2025-05-12T09:40:00") },
  { id: "lp-kai-3d-1", userId: "u-kai", lessonId: "lesson-3d-1", completedAt: ts("2026-08-20T16:00:00"), createdAt: ts("2026-08-20T16:00:00"), updatedAt: ts("2026-08-20T16:00:00") },
];

function quizAttempt(id, userId, moduleId, qIds, answers, scorePercent, passed, startedAt, submittedAt) {
  return {
    id,
    userId,
    moduleId,
    questionIds: qIds,
    answers,
    scorePercent,
    passed,
    startedAt,
    submittedAt,
    createdAt: startedAt,
    updatedAt: submittedAt,
  };
}

const soQ10 = shopQuestions.slice(0, 10).map((q) => q.id);
const soAnsPass = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const d3Q10 = print3dQuestions.slice(0, 10).map((q) => q.id);
const d3AnsPass = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const d3AnsFail = [0, 0, 1, 1, 0, 2, 0, 1, 0, 3]; // 60%

const quizAttempts = [
  quizAttempt("qa-maya-so-1", "u-maya", "mod-shop-orientation", soQ10, soAnsPass, 100, true, ts("2025-03-18T10:00:00"), ts("2025-03-18T10:18:00")),
  quizAttempt("qa-maya-3d-1", "u-maya", "mod-3d-printing", d3Q10, d3AnsPass, 100, true, ts("2025-03-25T11:30:00"), ts("2025-03-25T11:50:00")),
  quizAttempt("qa-morgan-so-1", "u-morgan", "mod-shop-orientation", soQ10, soAnsPass, 90, true, ts("2026-07-03T09:00:00"), ts("2026-07-03T09:20:00")),
  quizAttempt("qa-morgan-3d-fail", "u-morgan", "mod-3d-printing", d3Q10, d3AnsFail, 60, false, ts("2026-08-15T11:00:00"), ts("2026-08-15T11:22:00")),
  quizAttempt("qa-morgan-3d-pass", "u-morgan", "mod-3d-printing", d3Q10, d3AnsPass, 100, true, ts("2026-08-15T14:00:00"), ts("2026-08-15T14:25:00")),
  quizAttempt("qa-sam-so-1", "u-sam", "mod-shop-orientation", soQ10, soAnsPass, 80, true, ts("2025-05-12T10:00:00"), ts("2025-05-12T10:25:00")),
  quizAttempt("qa-jordan-3d-1", "u-jordan", "mod-3d-printing", d3Q10, d3AnsPass, 90, true, ts("2025-04-15T15:00:00"), ts("2025-04-15T15:20:00")),
];

// ─── Class sessions ──────────────────────────────────────────────────────────
const ZEFFY = "https://www.zeffy.com/en-US/donation-form/example-the-box";

const classSessions = [
  {
    id: "class-orient-0906",
    title: "Shop Orientation",
    slug: "shop-orientation-2026-09-06",
    descriptionSlug: "class-shop-orientation",
    category: "orientation",
    instructorId: "u-staff",
    startsAt: ts("2026-09-06T10:00:00"),
    endsAt: ts("2026-09-06T11:30:00"),
    capacity: 12,
    priceCents: 0,
    zeffyUrl: null,
    prerequisiteCertificationIds: [],
    location: "The Box — Main Floor",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-3d-0907",
    title: "Intro to 3D Printing",
    slug: "3d-printing-intro-2026-09-07",
    descriptionSlug: "class-3d-printing-intro",
    category: "workshop",
    instructorId: "u-staff",
    startsAt: ts("2026-09-07T13:00:00"),
    endsAt: ts("2026-09-07T15:00:00"),
    capacity: 8,
    priceCents: 3500,
    zeffyUrl: ZEFFY,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — 3D Corner",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-01T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-laser-0910",
    title: "Laser Cutter Basics",
    slug: "laser-basics-2026-09-10",
    descriptionSlug: "class-laser-basics",
    category: "certification_checkoff",
    instructorId: "u-admin",
    startsAt: ts("2026-09-10T17:00:00"),
    endsAt: ts("2026-09-10T19:00:00"),
    capacity: 4,
    priceCents: 4500,
    zeffyUrl: ZEFFY,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — Laser Bay",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-05T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-wood-0913",
    title: "Woodshop Safety & Basics",
    slug: "woodshop-safety-2026-09-13",
    descriptionSlug: "class-woodshop-safety",
    category: "workshop",
    instructorId: "u-staff",
    startsAt: ts("2026-09-13T11:00:00"),
    endsAt: ts("2026-09-13T13:30:00"),
    capacity: 6,
    priceCents: 4000,
    zeffyUrl: ZEFFY,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — Woodshop",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-05T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-sewing-0914",
    title: "Sewing Machine Basics",
    slug: "sewing-basics-2026-09-14",
    descriptionSlug: "class-sewing-basics",
    category: "workshop",
    instructorId: "u-staff",
    startsAt: ts("2026-09-14T14:00:00"),
    endsAt: ts("2026-09-14T16:00:00"),
    capacity: 6,
    priceCents: 2500,
    zeffyUrl: ZEFFY,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — Textiles",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-10T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-open-0917",
    title: "Open Studio Night",
    slug: "open-studio-2026-09-17",
    descriptionSlug: "class-open-studio-night",
    category: "open_studio",
    instructorId: "u-staff",
    startsAt: ts("2026-09-17T17:00:00"),
    endsAt: ts("2026-09-17T20:00:00"),
    capacity: 20,
    priceCents: 0,
    zeffyUrl: null,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — All Areas",
    cancellationCutoffHours: 12,
    published: true,
    createdAt: ts("2026-08-10T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-emb-0920",
    title: "Embroidery Machine Intro",
    slug: "embroidery-intro-2026-09-20",
    descriptionSlug: "class-embroidery-intro",
    category: "workshop",
    instructorId: "u-staff",
    startsAt: ts("2026-09-20T11:00:00"),
    endsAt: ts("2026-09-20T13:00:00"),
    capacity: 4,
    priceCents: 3000,
    zeffyUrl: ZEFFY,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — Textiles",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-12T10:00:00"),
    updatedAt: NOW,
  },
  {
    id: "class-sub-0924",
    title: "Sublimation Workshop",
    slug: "sublimation-workshop-2026-09-24",
    descriptionSlug: "class-sublimation-workshop",
    category: "workshop",
    instructorId: "u-admin",
    startsAt: ts("2026-09-24T15:00:00"),
    endsAt: ts("2026-09-24T17:30:00"),
    capacity: 6,
    priceCents: 5000,
    zeffyUrl: ZEFFY,
    prerequisiteCertificationIds: ["cert-shop-orientation"],
    location: "The Box — Sublimation Station",
    cancellationCutoffHours: 24,
    published: true,
    createdAt: ts("2026-08-15T10:00:00"),
    updatedAt: NOW,
  },
];

// Laser class is FULL with waitlist — capacity 4 booked + waitlisted
const bookings = [
  // Full laser class (capacity 4)
  { id: "bk-laser-maya", classSessionId: "class-laser-0910", userId: "u-maya", status: "booked", paidAt: ts("2026-08-20T10:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-08-20T10:00:00"), updatedAt: ts("2026-08-20T10:00:00") },
  { id: "bk-laser-jordan", classSessionId: "class-laser-0910", userId: "u-jordan", status: "booked", paidAt: ts("2026-08-21T11:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-08-21T11:00:00"), updatedAt: ts("2026-08-21T11:00:00") },
  { id: "bk-laser-kai", classSessionId: "class-laser-0910", userId: "u-kai", status: "booked", paidAt: ts("2026-08-22T09:00:00"), paidMarkedById: "u-admin", createdAt: ts("2026-08-22T09:00:00"), updatedAt: ts("2026-08-22T09:00:00") },
  { id: "bk-laser-sam", classSessionId: "class-laser-0910", userId: "u-sam", status: "booked", paidAt: ts("2026-08-23T14:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-08-23T14:00:00"), updatedAt: ts("2026-08-23T14:00:00") },
  { id: "bk-laser-nova-wl", classSessionId: "class-laser-0910", userId: "u-nova", status: "waitlisted", waitlistPosition: 1, createdAt: ts("2026-08-24T10:00:00"), updatedAt: ts("2026-08-24T10:00:00") },
  { id: "bk-laser-quinn-wl", classSessionId: "class-laser-0910", userId: "u-quinn", status: "waitlisted", waitlistPosition: 2, createdAt: ts("2026-08-25T10:00:00"), updatedAt: ts("2026-08-25T10:00:00") },

  // Drew awaiting payment for 3D class
  {
    id: "bk-3d-drew-await",
    classSessionId: "class-3d-0907",
    userId: "u-drew",
    status: "awaiting_payment",
    paymentHoldExpiresAt: ts("2026-09-06T12:00:00"),
    createdAt: ts("2026-09-04T10:00:00"),
    updatedAt: ts("2026-09-04T10:00:00"),
  },
  { id: "bk-3d-maya", classSessionId: "class-3d-0907", userId: "u-maya", status: "booked", paidAt: ts("2026-08-28T10:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-08-28T10:00:00"), updatedAt: ts("2026-08-28T10:00:00") },
  { id: "bk-3d-morgan", classSessionId: "class-3d-0907", userId: "u-morgan", status: "booked", paidAt: ts("2026-08-29T10:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-08-29T10:00:00"), updatedAt: ts("2026-08-29T10:00:00") },

  // Expired hold
  {
    id: "bk-sew-riley-expired",
    classSessionId: "class-sewing-0914",
    userId: "u-riley",
    status: "expired",
    paymentHoldExpiresAt: ts("2026-09-01T12:00:00"),
    createdAt: ts("2026-08-30T10:00:00"),
    updatedAt: ts("2026-09-01T12:05:00"),
  },

  // Orientation free bookings
  { id: "bk-orient-avery", classSessionId: "class-orient-0906", userId: "u-avery", status: "booked", createdAt: ts("2026-09-03T16:00:00"), updatedAt: ts("2026-09-03T16:00:00") },
  { id: "bk-orient-riley", classSessionId: "class-orient-0906", userId: "u-riley", status: "booked", createdAt: ts("2026-09-01T10:00:00"), updatedAt: ts("2026-09-01T10:00:00") },
  { id: "bk-open-jordan", classSessionId: "class-open-0917", userId: "u-jordan", status: "booked", createdAt: ts("2026-09-02T10:00:00"), updatedAt: ts("2026-09-02T10:00:00") },
  { id: "bk-wood-kai", classSessionId: "class-wood-0913", userId: "u-kai", status: "booked", paidAt: ts("2026-09-01T11:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-09-01T11:00:00"), updatedAt: ts("2026-09-01T11:00:00") },
  { id: "bk-sub-jordan", classSessionId: "class-sub-0924", userId: "u-jordan", status: "booked", paidAt: ts("2026-09-03T09:00:00"), paidMarkedById: "u-admin", createdAt: ts("2026-09-03T09:00:00"), updatedAt: ts("2026-09-03T09:00:00") },
  { id: "bk-emb-nova", classSessionId: "class-emb-0920", userId: "u-nova", status: "booked", paidAt: ts("2026-09-02T14:00:00"), paidMarkedById: "u-staff", createdAt: ts("2026-09-02T14:00:00"), updatedAt: ts("2026-09-02T14:00:00") },
  { id: "bk-sew-nova", classSessionId: "class-sewing-0914", userId: "u-nova", status: "cancelled", cancelledAt: ts("2026-09-03T10:00:00"), createdAt: ts("2026-08-28T10:00:00"), updatedAt: ts("2026-09-03T10:00:00") },
];

// ─── Reservations (~40) ──────────────────────────────────────────────────────
function res(id, userId, machineId, startsAt, endsAt, status, extras = {}) {
  return {
    id,
    userId,
    machineId,
    startsAt,
    endsAt,
    status,
    createdById: extras.createdById ?? userId,
    cancelledAt: extras.cancelledAt ?? null,
    cancelReason: extras.cancelReason ?? null,
    createdAt: extras.createdAt ?? startsAt,
    updatedAt: extras.updatedAt ?? (extras.cancelledAt ?? startsAt),
  };
}

const reservations = [
  // Quinn at limit — 3 open future booked
  res("res-quinn-1", "u-quinn", "m-laser-co2", ts("2026-09-05T16:00:00"), ts("2026-09-05T18:00:00"), "booked"),
  res("res-quinn-2", "u-quinn", "m-bambu-x1", ts("2026-09-06T14:00:00"), ts("2026-09-06T16:00:00"), "booked"),
  res("res-quinn-3", "u-quinn", "m-table-saw", ts("2026-09-07T11:00:00"), ts("2026-09-07T13:00:00"), "booked"),

  // Maya future + past
  res("res-maya-laser-f", "u-maya", "m-laser-co2", ts("2026-09-08T17:00:00"), ts("2026-09-08T19:00:00"), "booked"),
  res("res-maya-prusa-f", "u-maya", "m-prusa-mk4", ts("2026-09-09T16:00:00"), ts("2026-09-09T18:00:00"), "booked"),
  res("res-maya-laser-p", "u-maya", "m-laser-co2", ts("2026-08-20T17:00:00"), ts("2026-08-20T19:00:00"), "completed"),
  res("res-maya-prusa-p", "u-maya", "m-prusa-mk4", ts("2026-08-15T14:00:00"), ts("2026-08-15T16:00:00"), "completed"),
  res("res-maya-cancel", "u-maya", "m-laser-co2", ts("2026-08-28T17:00:00"), ts("2026-08-28T18:30:00"), "cancelled", { cancelledAt: ts("2026-08-27T10:00:00"), cancelReason: "Schedule conflict" }),

  // Overlapping-risk: same machine adjacent slots (non-overlapping)
  res("res-jordan-laser-a", "u-jordan", "m-laser-co2", ts("2026-09-11T16:00:00"), ts("2026-09-11T17:30:00"), "booked"),
  res("res-kai-laser-b", "u-kai", "m-laser-co2", ts("2026-09-11T17:30:00"), ts("2026-09-11T19:00:00"), "booked"),
  res("res-sam-laser-c", "u-sam", "m-laser-co2", ts("2026-09-12T10:00:00"), ts("2026-09-12T11:30:00"), "booked"),
  res("res-nova-laser-d", "u-nova", "m-laser-co2", ts("2026-09-12T12:00:00"), ts("2026-09-12T13:30:00"), "booked"),

  // Same day different machines (risk scenario for user hour limits demo)
  res("res-jordan-3d", "u-jordan", "m-bambu-x1", ts("2026-09-15T14:00:00"), ts("2026-09-15T15:30:00"), "booked"),
  res("res-jordan-vinyl", "u-jordan", "m-vinyl-cutter", ts("2026-09-15T16:00:00"), ts("2026-09-15T17:00:00"), "booked"),

  // Kai woodshop
  res("res-kai-tablesaw-f", "u-kai", "m-table-saw", ts("2026-09-13T14:00:00"), ts("2026-09-13T16:00:00"), "booked"),
  res("res-kai-miter-p", "u-kai", "m-miter-saw", ts("2026-08-10T15:00:00"), ts("2026-08-10T16:30:00"), "completed"),
  res("res-kai-band-p", "u-kai", "m-band-saw", ts("2026-07-22T16:00:00"), ts("2026-07-22T17:00:00"), "completed"),
  res("res-kai-noshow", "u-kai", "m-planer-jointer", ts("2026-08-05T17:00:00"), ts("2026-08-05T18:00:00"), "no_show"),

  // Nova textiles
  res("res-nova-emb-f", "u-nova", "m-embroidery", ts("2026-09-16T14:00:00"), ts("2026-09-16T16:00:00"), "booked"),
  res("res-nova-sew-p", "u-nova", "m-sewing-1", ts("2026-08-18T15:00:00"), ts("2026-08-18T17:00:00"), "completed"),
  res("res-nova-vinyl-p", "u-nova", "m-vinyl-cutter", ts("2026-08-12T14:00:00"), ts("2026-08-12T15:00:00"), "completed"),
  res("res-nova-cancel", "u-nova", "m-sewing-2", ts("2026-09-01T14:00:00"), ts("2026-09-01T15:30:00"), "cancelled", { cancelledAt: ts("2026-08-31T09:00:00"), cancelReason: "Machine B preferred" }),

  // Sam
  res("res-sam-prusa-f", "u-sam", "m-prusa-mk4", ts("2026-09-18T16:00:00"), ts("2026-09-18T18:00:00"), "booked"),
  res("res-sam-prusa-p", "u-sam", "m-prusa-mk4", ts("2026-07-15T14:00:00"), ts("2026-07-15T16:00:00"), "completed"),
  res("res-sam-saturn-p", "u-sam", "m-elegoo-saturn", ts("2026-06-20T13:00:00"), ts("2026-06-20T15:00:00"), "completed"),

  // Drew / Taylor / Morgan past
  res("res-drew-bambu-p", "u-drew", "m-bambu-x1", ts("2026-08-22T14:00:00"), ts("2026-08-22T16:00:00"), "completed"),
  res("res-taylor-prusa-p", "u-taylor", "m-prusa-mk4", ts("2026-07-08T15:00:00"), ts("2026-07-08T17:00:00"), "completed"),
  res("res-taylor-laser-exp", "u-taylor", "m-laser-co2", ts("2026-02-20T16:00:00"), ts("2026-02-20T18:00:00"), "completed"),
  res("res-morgan-prusa-f", "u-morgan", "m-prusa-mk4", ts("2026-09-19T15:00:00"), ts("2026-09-19T16:30:00"), "booked", { createdById: "u-staff" }),

  // Staff / admin blocks for demos
  res("res-staff-laser", "u-staff", "m-laser-co2", ts("2026-09-14T10:00:00"), ts("2026-09-14T12:00:00"), "booked"),
  res("res-admin-tablesaw", "u-admin", "m-table-saw", ts("2026-09-20T10:00:00"), ts("2026-09-20T12:00:00"), "booked"),

  // More historical variety
  res("res-jordan-sub-p", "u-jordan", "m-sub-printer", ts("2026-06-14T13:00:00"), ts("2026-06-14T14:30:00"), "completed"),
  res("res-jordan-heat-p", "u-jordan", "m-heat-press", ts("2026-06-14T14:30:00"), ts("2026-06-14T15:30:00"), "completed"),
  res("res-maya-router-p", "u-maya", "m-router-table", ts("2026-05-10T15:00:00"), ts("2026-05-10T16:30:00"), "completed"),
  res("res-kai-router-p", "u-kai", "m-router-table", ts("2026-04-18T14:00:00"), ts("2026-04-18T15:30:00"), "completed"),
  res("res-quinn-laser-p", "u-quinn", "m-laser-co2", ts("2026-07-30T16:00:00"), ts("2026-07-30T18:00:00"), "completed"),
  res("res-quinn-3d-p", "u-quinn", "m-bambu-x1", ts("2026-06-05T14:00:00"), ts("2026-06-05T16:00:00"), "completed"),
  res("res-drew-cancel", "u-drew", "m-laser-co2", ts("2026-09-03T17:00:00"), ts("2026-09-03T18:30:00"), "cancelled", { cancelledAt: ts("2026-09-02T12:00:00"), cancelReason: "Payment pending for class instead" }),
  res("res-jamie-miter-p", "u-jamie", "m-miter-saw", ts("2026-05-22T16:00:00"), ts("2026-05-22T17:00:00"), "completed"),
  res("res-riley-prusa", "u-riley", "m-prusa-mk4", ts("2026-08-22T13:00:00"), ts("2026-08-22T14:00:00"), "completed", { createdById: "u-staff" }),
];

const maintenanceBlocks = [
  {
    id: "maint-laser-optics",
    machineId: "m-laser-co2",
    startsAt: ts("2026-09-09T09:00:00"),
    endsAt: ts("2026-09-09T13:00:00"),
    reason: "Optics cleaning and alignment",
    createdById: "u-admin",
    createdAt: ts("2026-09-01T10:00:00"),
    updatedAt: ts("2026-09-01T10:00:00"),
  },
  {
    id: "maint-tablesaw-blade",
    machineId: "m-table-saw",
    startsAt: ts("2026-09-15T08:00:00"),
    endsAt: ts("2026-09-15T12:00:00"),
    reason: "Blade change and brake cartridge check",
    createdById: "u-staff",
    createdAt: ts("2026-09-02T09:00:00"),
    updatedAt: ts("2026-09-02T09:00:00"),
  },
  {
    id: "maint-embroidery-service",
    machineId: "m-embroidery",
    startsAt: ts("2026-08-01T10:00:00"),
    endsAt: ts("2026-08-01T16:00:00"),
    reason: "Annual service — tension calibration",
    createdById: "u-admin",
    createdAt: ts("2026-07-20T10:00:00"),
    updatedAt: ts("2026-07-20T10:00:00"),
  },
];

// ─── Access logs ─────────────────────────────────────────────────────────────
const accessLogs = [
  { id: "al-01", readerKey: "reader-3d-prusa-mk4", machineId: "m-prusa-mk4", badgeUid: "c3d4e5f60718293a", userId: "u-maya", allow: true, reason: "ok", sessionId: null, requestedAt: ts("2026-09-03T16:05:00"), createdAt: ts("2026-09-03T16:05:00"), updatedAt: ts("2026-09-03T16:05:00") },
  { id: "al-02", readerKey: "reader-laser-omtech-60w", machineId: "m-laser-co2", badgeUid: "c3d4e5f60718293a", userId: "u-maya", allow: true, reason: "ok", reservationNotice: "Reservation starts in 10 minutes", sessionId: null, requestedAt: ts("2026-08-20T16:50:00"), createdAt: ts("2026-08-20T16:50:00"), updatedAt: ts("2026-08-20T16:50:00") },
  { id: "al-03", readerKey: "reader-laser-omtech-60w", machineId: "m-laser-co2", badgeUid: "4b5c6d7e8f901234", userId: "u-taylor", allow: false, reason: "cert_expired", requestedAt: ts("2026-09-02T17:00:00"), createdAt: ts("2026-09-02T17:00:00"), updatedAt: ts("2026-09-02T17:00:00") },
  { id: "al-04", readerKey: "reader-laser-omtech-60w", machineId: "m-laser-co2", badgeUid: "3a4b5c6d7e8f9012", userId: "u-casey", allow: false, reason: "user_inactive", requestedAt: ts("2026-08-29T16:00:00"), createdAt: ts("2026-08-29T16:00:00"), updatedAt: ts("2026-08-29T16:00:00") },
  { id: "al-05", readerKey: "reader-3d-bambu-x1", machineId: "m-bambu-x1", badgeUid: "293a4b5c6d7e8f90", userId: "u-alex", allow: false, reason: "user_inactive", requestedAt: ts("2026-08-20T14:00:00"), createdAt: ts("2026-08-20T14:00:00"), updatedAt: ts("2026-08-20T14:00:00") },
  { id: "al-06", readerKey: "reader-wood-tablesaw", machineId: "m-table-saw", badgeUid: "6d7e8f9012345678", userId: "u-jamie", allow: false, reason: "waiver_outdated", requestedAt: ts("2026-09-01T15:00:00"), createdAt: ts("2026-09-01T15:00:00"), updatedAt: ts("2026-09-01T15:00:00") },
  { id: "al-07", readerKey: "reader-3d-prusa-mk4", machineId: "m-prusa-mk4", badgeUid: "5c6d7e8f90123456", userId: "u-morgan", allow: false, reason: "cert_missing", requestedAt: ts("2026-08-16T14:00:00"), createdAt: ts("2026-08-16T14:00:00"), updatedAt: ts("2026-08-16T14:00:00") },
  { id: "al-08", readerKey: "reader-laser-omtech-60w", machineId: "m-laser-co2", badgeUid: "3a4b5c6d7e8f9012", userId: "u-casey", allow: false, reason: "cert_revoked", requestedAt: ts("2026-08-28T17:00:00"), createdAt: ts("2026-08-28T17:00:00"), updatedAt: ts("2026-08-28T17:00:00") },
  { id: "al-09", readerKey: "reader-3d-prusa-mk4", machineId: "m-prusa-mk4", badgeUid: "deadbeef00000001", userId: null, allow: false, reason: "unknown_badge", requestedAt: ts("2026-09-03T12:00:00"), createdAt: ts("2026-09-03T12:00:00"), updatedAt: ts("2026-09-03T12:00:00") },
  { id: "al-10", readerKey: "reader-unknown-xyz", machineId: null, badgeUid: "c3d4e5f60718293a", userId: "u-maya", allow: false, reason: "unknown_reader", requestedAt: ts("2026-09-03T12:05:00"), createdAt: ts("2026-09-03T12:05:00"), updatedAt: ts("2026-09-03T12:05:00") },
  { id: "al-11", readerKey: "reader-tex-sewing-a", machineId: "m-sewing-1", badgeUid: "0718293a4b5c6d7e", userId: "u-nova", allow: true, reason: "ok", requestedAt: ts("2026-08-18T15:02:00"), createdAt: ts("2026-08-18T15:02:00"), updatedAt: ts("2026-08-18T15:02:00") },
  { id: "al-12", readerKey: "reader-wood-tablesaw", machineId: "m-table-saw", badgeUid: "18293a4b5c6d7e8f", userId: "u-kai", allow: true, reason: "ok", requestedAt: ts("2026-08-10T15:01:00"), createdAt: ts("2026-08-10T15:01:00"), updatedAt: ts("2026-08-10T15:01:00") },
  { id: "al-13", readerKey: "reader-3d-bambu-x1", machineId: "m-bambu-x1", badgeUid: "d4e5f60718293a4b", userId: "u-jordan", allow: true, reason: "ok", requestedAt: ts("2026-09-01T14:00:00"), createdAt: ts("2026-09-01T14:00:00"), updatedAt: ts("2026-09-01T14:00:00") },
  { id: "al-14", readerKey: "reader-sub-printer", machineId: "m-sub-printer", badgeUid: "d4e5f60718293a4b", userId: "u-jordan", allow: true, reason: "ok", requestedAt: ts("2026-06-14T13:05:00"), createdAt: ts("2026-06-14T13:05:00"), updatedAt: ts("2026-06-14T13:05:00") },
  { id: "al-15", readerKey: "reader-tex-embroidery", machineId: "m-embroidery", badgeUid: "0718293a4b5c6d7e", userId: "u-nova", allow: true, reason: "ok", requestedAt: ts("2026-07-22T14:00:00"), createdAt: ts("2026-07-22T14:00:00"), updatedAt: ts("2026-07-22T14:00:00") },
  { id: "al-16", readerKey: "reader-3d-prusa-mk4", machineId: "m-prusa-mk4", badgeUid: "e5f60718293a4b5c", userId: "u-sam", allow: true, reason: "ok", requestedAt: ts("2026-07-15T14:02:00"), createdAt: ts("2026-07-15T14:02:00"), updatedAt: ts("2026-07-15T14:02:00") },
  { id: "al-17", readerKey: "reader-wood-miter", machineId: "m-miter-saw", badgeUid: "90123456789abcde", userId: null, allow: false, reason: "badge_unlinked", requestedAt: ts("2026-09-02T11:00:00"), createdAt: ts("2026-09-02T11:00:00"), updatedAt: ts("2026-09-02T11:00:00") },
  { id: "al-18", readerKey: "reader-laser-omtech-60w", machineId: "m-laser-co2", badgeUid: "3a4b5c6d7e8f9012", userId: "u-casey", allow: false, reason: "badge_inactive", requestedAt: ts("2026-08-30T16:00:00"), createdAt: ts("2026-08-30T16:00:00"), updatedAt: ts("2026-08-30T16:00:00") },
  { id: "al-19", readerKey: "reader-wood-planer", machineId: "m-planer-jointer", badgeUid: "18293a4b5c6d7e8f", userId: "u-kai", allow: true, reason: "ok", requestedAt: ts("2026-07-01T16:00:00"), createdAt: ts("2026-07-01T16:00:00"), updatedAt: ts("2026-07-01T16:00:00") },
  { id: "al-20", readerKey: "reader-3d-elegoo-saturn", machineId: "m-elegoo-saturn", badgeUid: "e5f60718293a4b5c", userId: "u-sam", allow: true, reason: "ok", requestedAt: ts("2026-06-20T13:05:00"), createdAt: ts("2026-06-20T13:05:00"), updatedAt: ts("2026-06-20T13:05:00") },
  { id: "al-21", readerKey: "reader-tex-vinyl", machineId: "m-vinyl-cutter", badgeUid: "d4e5f60718293a4b", userId: "u-jordan", allow: true, reason: "ok", requestedAt: ts("2026-08-12T14:01:00"), createdAt: ts("2026-08-12T14:01:00"), updatedAt: ts("2026-08-12T14:01:00") },
];

// ─── Volunteer ───────────────────────────────────────────────────────────────
const volunteerRoles = [
  { id: "vr-front-desk", slug: "front-desk", title: "Front Desk Greeter", contentSlug: "volunteer-front-desk", active: true, sortOrder: 1, createdAt: T0, updatedAt: NOW },
  { id: "vr-shop-steward", slug: "shop-steward", title: "Shop Steward", contentSlug: "volunteer-shop-steward", active: true, sortOrder: 2, createdAt: T0, updatedAt: NOW },
  { id: "vr-events", slug: "events", title: "Events & Outreach Helper", contentSlug: "volunteer-events", active: true, sortOrder: 3, createdAt: T0, updatedAt: NOW },
];

const volunteerInterests = [
  { id: "vi-01", name: "Chris Alvarez", email: "chris.alvarez@example.com", phone: "+1-206-555-0401", roleId: "vr-front-desk", message: "Happy to greet visitors on Saturday mornings.", status: "new", userId: null, createdAt: ts("2026-09-01T10:00:00"), updatedAt: ts("2026-09-01T10:00:00") },
  { id: "vi-02", name: "Nova Park", email: "nova.park@example.com", roleId: "vr-shop-steward", message: "I'd love to help during Thursday open hours in textiles.", status: "contacted", userId: "u-nova", reviewedById: "u-staff", reviewedAt: ts("2026-08-20T11:00:00"), notes: "Left voicemail 8/20", createdAt: ts("2026-08-15T10:00:00"), updatedAt: ts("2026-08-20T11:00:00") },
  { id: "vi-03", name: "Kai Nakamura", email: "kai.nakamura@example.com", roleId: "vr-shop-steward", message: "Woodshop steward interest — evenings OK.", status: "accepted", userId: "u-kai", reviewedById: "u-admin", reviewedAt: ts("2026-07-10T14:00:00"), notes: "Onboarded 7/12", createdAt: ts("2026-07-01T10:00:00"), updatedAt: ts("2026-07-10T14:00:00") },
  { id: "vi-04", name: "Jordan Lee", email: "jordan.lee@example.com", roleId: "vr-events", message: "Can help with make-night setup once a month.", status: "accepted", userId: "u-jordan", reviewedById: "u-staff", reviewedAt: ts("2026-06-15T10:00:00"), createdAt: ts("2026-06-01T10:00:00"), updatedAt: ts("2026-06-15T10:00:00") },
  { id: "vi-05", name: "Pat Nguyen", email: "pat.nguyen@example.com", roleId: "vr-front-desk", message: "Interested but schedule is uncertain.", status: "declined", userId: null, reviewedById: "u-staff", reviewedAt: ts("2026-08-05T09:00:00"), notes: "Declined — conflict with work", createdAt: ts("2026-07-28T10:00:00"), updatedAt: ts("2026-08-05T09:00:00") },
  { id: "vi-06", name: "Old Interest", email: "old.volunteer@example.com", roleId: "vr-events", message: "From last year's fair.", status: "archived", userId: null, reviewedById: "u-admin", reviewedAt: ts("2025-11-01T10:00:00"), createdAt: ts("2025-10-01T10:00:00"), updatedAt: ts("2025-11-01T10:00:00") },
];

// ─── Waivers & policies ──────────────────────────────────────────────────────
function waiver(id, userId, version, signedAt, fullName) {
  return {
    id,
    userId,
    version,
    signedAt,
    fullNameTyped: fullName,
    ip: "203.0.113." + (10 + Math.abs(hashCode(id) % 200)),
    userAgent: "Mozilla/5.0 (fixture)",
    createdAt: signedAt,
    updatedAt: signedAt,
  };
}
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

const waiverSignatures = [
  waiver("ws-admin", "u-admin", "2026.1", ts("2026-01-05T10:00:00"), "Avery Admin"),
  waiver("ws-staff", "u-staff", "2026.1", ts("2026-01-05T10:05:00"), "Sam Stafford"),
  waiver("ws-maya", "u-maya", "2026.1", ts("2026-01-10T11:00:00"), "Maya Chen"),
  waiver("ws-jordan", "u-jordan", "2026.1", ts("2026-01-12T11:00:00"), "Jordan Lee"),
  waiver("ws-sam", "u-sam", "2026.1", ts("2026-01-15T11:00:00"), "Sam Patel"),
  waiver("ws-riley", "u-riley", "2026.1", ts("2026-08-20T10:30:00"), "Riley Brooks"),
  waiver("ws-nova", "u-nova", "2026.1", ts("2026-01-20T11:00:00"), "Nova Park"),
  waiver("ws-kai", "u-kai", "2026.1", ts("2026-01-22T11:00:00"), "Kai Nakamura"),
  waiver("ws-alex", "u-alex", "2026.1", ts("2026-01-08T11:00:00"), "Alex Rivera"),
  waiver("ws-casey", "u-casey", "2026.1", ts("2026-01-09T11:00:00"), "Casey Nguyen"),
  waiver("ws-taylor", "u-taylor", "2026.1", ts("2026-01-11T11:00:00"), "Taylor Kim"),
  waiver("ws-morgan", "u-morgan", "2026.1", ts("2026-07-03T11:00:00"), "Morgan Ellis"),
  waiver("ws-jamie-old", "u-jamie", "2025.2", ts("2025-02-01T11:00:00"), "Jamie Ortiz"), // outdated
  waiver("ws-drew", "u-drew", "2026.1", ts("2026-01-18T11:00:00"), "Drew Santos"),
  waiver("ws-quinn", "u-quinn", "2026.1", ts("2026-01-19T11:00:00"), "Quinn Walsh"),
  // u-avery has no waiver — unsigned
];

function policyAck(id, userId, version, at) {
  return {
    id,
    userId,
    policySlug: "member-expectations",
    version,
    acknowledgedAt: at,
    createdAt: at,
    updatedAt: at,
  };
}

const policyAcknowledgements = [
  policyAck("pa-admin", "u-admin", "2026.1", ts("2026-01-05T10:10:00")),
  policyAck("pa-staff", "u-staff", "2026.1", ts("2026-01-05T10:15:00")),
  policyAck("pa-maya", "u-maya", "2026.1", ts("2026-01-10T11:10:00")),
  policyAck("pa-jordan", "u-jordan", "2026.1", ts("2026-01-12T11:10:00")),
  policyAck("pa-sam", "u-sam", "2026.1", ts("2026-01-15T11:10:00")),
  policyAck("pa-riley", "u-riley", "2026.1", ts("2026-08-20T10:40:00")),
  policyAck("pa-nova", "u-nova", "2026.1", ts("2026-01-20T11:10:00")),
  policyAck("pa-kai", "u-kai", "2026.1", ts("2026-01-22T11:10:00")),
  policyAck("pa-taylor", "u-taylor", "2026.1", ts("2026-01-11T11:10:00")),
  policyAck("pa-morgan", "u-morgan", "2026.1", ts("2026-07-03T11:10:00")),
  policyAck("pa-jamie-old", "u-jamie", "2025.2", ts("2025-02-01T11:15:00")), // outdated
  policyAck("pa-drew", "u-drew", "2026.1", ts("2026-01-18T11:10:00")),
  policyAck("pa-quinn", "u-quinn", "2026.1", ts("2026-01-19T11:10:00")),
];

// ─── Audit events ────────────────────────────────────────────────────────────
const auditEvents = [
  { id: "ae-01", action: "waiver_signed", actorId: "u-maya", subjectUserId: "u-maya", entityType: "WaiverSignature", entityId: "ws-maya", occurredAt: ts("2026-01-10T11:00:00"), createdAt: ts("2026-01-10T11:00:00"), updatedAt: ts("2026-01-10T11:00:00"), metadata: { version: "2026.1" } },
  { id: "ae-02", action: "policy_acknowledged", actorId: "u-maya", subjectUserId: "u-maya", entityType: "PolicyAcknowledgement", entityId: "pa-maya", occurredAt: ts("2026-01-10T11:10:00"), createdAt: ts("2026-01-10T11:10:00"), updatedAt: ts("2026-01-10T11:10:00"), metadata: { policySlug: "member-expectations", version: "2026.1" } },
  { id: "ae-03", action: "cert_knowledge_passed", actorId: "u-morgan", subjectUserId: "u-morgan", entityType: "UserCertification", entityId: "uc-morgan-3d", occurredAt: ts("2026-08-15T14:30:00"), createdAt: ts("2026-08-15T14:30:00"), updatedAt: ts("2026-08-15T14:30:00"), metadata: { certificationId: "cert-3d-printing" } },
  { id: "ae-04", action: "cert_checked_off", actorId: "u-staff", subjectUserId: "u-maya", entityType: "UserCertification", entityId: "uc-maya-3d", occurredAt: ts("2025-03-28T10:00:00"), createdAt: ts("2025-03-28T10:00:00"), updatedAt: ts("2025-03-28T10:00:00"), metadata: { certificationId: "cert-3d-printing" } },
  { id: "ae-05", action: "cert_revoked", actorId: "u-admin", subjectUserId: "u-casey", entityType: "UserCertification", entityId: "uc-casey-laser", occurredAt: ts("2026-08-28T16:00:00"), createdAt: ts("2026-08-28T16:00:00"), updatedAt: ts("2026-08-28T16:00:00"), metadata: { reason: "Unsafe laser operation" } },
  { id: "ae-06", action: "cert_expired", actorId: null, subjectUserId: "u-taylor", entityType: "UserCertification", entityId: "uc-taylor-laser", occurredAt: ts("2026-03-05T10:00:00"), createdAt: ts("2026-03-05T10:00:00"), updatedAt: ts("2026-03-05T10:00:00"), metadata: { certificationId: "cert-laser-cutter" } },
  { id: "ae-07", action: "status_changed", actorId: "u-admin", subjectUserId: "u-casey", entityType: "User", entityId: "u-casey", occurredAt: ts("2026-08-28T16:05:00"), createdAt: ts("2026-08-28T16:05:00"), updatedAt: ts("2026-08-28T16:05:00"), metadata: { from: "active", to: "suspended" } },
  { id: "ae-08", action: "status_changed", actorId: "u-admin", subjectUserId: "u-alex", entityType: "User", entityId: "u-alex", occurredAt: ts("2026-08-15T09:00:00"), createdAt: ts("2026-08-15T09:00:00"), updatedAt: ts("2026-08-15T09:00:00"), metadata: { from: "active", to: "lapsed" } },
  { id: "ae-09", action: "badge_linked", actorId: "u-staff", subjectUserId: "u-riley", entityType: "Badge", entityId: "badge-riley", occurredAt: ts("2026-08-20T11:00:00"), createdAt: ts("2026-08-20T11:00:00"), updatedAt: ts("2026-08-20T11:00:00"), metadata: { uid: "f60718293a4b5c6d" } },
  { id: "ae-10", action: "badge_unlinked", actorId: "u-admin", subjectUserId: "u-casey", entityType: "Badge", entityId: "badge-casey", occurredAt: ts("2026-08-28T16:10:00"), createdAt: ts("2026-08-28T16:10:00"), updatedAt: ts("2026-08-28T16:10:00"), metadata: { note: "Deactivated with suspension" } },
  { id: "ae-11", action: "booking_marked_paid", actorId: "u-staff", subjectUserId: "u-maya", entityType: "Booking", entityId: "bk-laser-maya", occurredAt: ts("2026-08-20T10:00:00"), createdAt: ts("2026-08-20T10:00:00"), updatedAt: ts("2026-08-20T10:00:00"), metadata: { classSessionId: "class-laser-0910" } },
  { id: "ae-12", action: "reservation_overridden", actorId: "u-staff", subjectUserId: "u-morgan", entityType: "Reservation", entityId: "res-morgan-prusa-f", occurredAt: ts("2026-09-03T10:00:00"), createdAt: ts("2026-09-03T10:00:00"), updatedAt: ts("2026-09-03T10:00:00"), metadata: { reason: "Staff-created for checkoff prep" } },
  { id: "ae-13", action: "maintenance_created", actorId: "u-admin", entityType: "MaintenanceBlock", entityId: "maint-laser-optics", occurredAt: ts("2026-09-01T10:00:00"), createdAt: ts("2026-09-01T10:00:00"), updatedAt: ts("2026-09-01T10:00:00"), metadata: { machineId: "m-laser-co2" } },
  { id: "ae-14", action: "waiver_signed", actorId: "u-riley", subjectUserId: "u-riley", entityType: "WaiverSignature", entityId: "ws-riley", occurredAt: ts("2026-08-20T10:30:00"), createdAt: ts("2026-08-20T10:30:00"), updatedAt: ts("2026-08-20T10:30:00"), metadata: { version: "2026.1" } },
  { id: "ae-15", action: "cert_checked_off", actorId: "u-admin", subjectUserId: "u-kai", entityType: "UserCertification", entityId: "uc-kai-tablesaw", occurredAt: ts("2025-07-08T10:00:00"), createdAt: ts("2025-07-08T10:00:00"), updatedAt: ts("2025-07-08T10:00:00"), metadata: { certificationId: "cert-table-saw" } },
];

// ─── Write all ───────────────────────────────────────────────────────────────
export function generateAll() {
  fs.mkdirSync(MOCK, { recursive: true });

  const counts = {};
  counts.users = writeJson("users.json", users);
  counts.badges = writeJson("badges.json", badges);
  counts.certifications = writeJson("certifications.json", certifications);
  counts.userCertifications = writeJson("user-certifications.json", userCertifications);
  counts.machines = writeJson("machines.json", machines);
  counts.settings = writeJson("settings.json", settings);
  counts.contentPages = writeJson("content-pages.json", contentPages);
  counts.classSessions = writeJson("class-sessions.json", classSessions);
  counts.bookings = writeJson("bookings.json", bookings);
  counts.learningModules = writeJson("learning-modules.json", learningModules);
  counts.lessons = writeJson("lessons.json", lessons);
  counts.questions = writeJson("questions.json", questions);
  counts.lessonProgress = writeJson("lesson-progress.json", lessonProgress);
  counts.quizAttempts = writeJson("quiz-attempts.json", quizAttempts);
  counts.reservations = writeJson("reservations.json", reservations);
  counts.maintenanceBlocks = writeJson("maintenance-blocks.json", maintenanceBlocks);
  counts.accessLogs = writeJson("access-logs.json", accessLogs);
  counts.volunteerRoles = writeJson("volunteer-roles.json", volunteerRoles);
  counts.volunteerInterests = writeJson("volunteer-interests.json", volunteerInterests);
  counts.waiverSignatures = writeJson("waiver-signatures.json", waiverSignatures);
  counts.policyAcknowledgements = writeJson("policy-acknowledgements.json", policyAcknowledgements);
  counts.auditEvents = writeJson("audit-events.json", auditEvents);

  const usageSessions = generateUsageSessions({
    machines,
    badges: badges.filter((b) => b.userId && b.active),
    users: users.filter((u) => u.status === "active" && u.profileComplete),
  });
  counts.usageSessions = writeJson("usage-sessions.json", usageSessions);

  return counts;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const counts = generateAll();
  console.log("Mock fixtures written to data/mock/");
  console.log(JSON.stringify(counts, null, 2));
}
