# Machine billing & print gating — spec (v1, Oct 25 2026)

Owner: James (The Box, Burien Makerspace). Written for Cursor / ChatGPT / Claude working in this repo.
Status: **approved direction, build it.** Rates marked DRAFT are editable in admin, not hard-coded.

## 0. The one-paragraph version

We are retiring the NFC badge + ESP32 "Badger" as the way machine time gets charged. Instead, a member
logs into the portal, submits a job, the portal reads the software's own estimate (print minutes +
filament grams from the sliced 3MF; CNC/plasma minutes typed from the controller), checks that the
member is allowed to run that machine (active membership, current waiver, the machine's certifications),
shows the price, and only then releases the job. For the four Bambu Lab A1 printers the portal itself
sends the 3MF to the printer over the LAN, so **nothing can be printed without going through the portal.**
The charge is posted when the job is released, against the member's credit first, then as a balance owed.

## 1. Why this works on the A1s (and the constraint it creates)

- Each A1 is switched to **LAN-only Mode + Developer Mode** (firmware ≥ 01.05). In that mode the printer
  accepts jobs from local software that knows the printer's IP, serial, and **access code**.
- The access code lives **only on the portal server** (env/DB), never on member machines. Members'
  Bambu Studio is NOT paired to the printers. They slice, export the 3MF, and upload it in the portal.
  That is the lock: no code, no print.
- The 3MF (`Metadata/slice_info.config` + `Metadata/plate_*.gcode` header) carries the slicer's
  estimated time and filament weight. We parse it server-side; we do not trust anything typed by the member.
- Cost: Bambu Handy / cloud monitoring stops working for those printers; firmware updates go on by SD card.
  The portal's job page replaces Handy (status, progress, cancel) via the same LAN MQTT connection.
- The server that talks to the printers must be on the shop LAN. If the portal is hosted off-site, run a
  small **print bridge** service on a shop PC/Raspberry Pi that polls the portal for released jobs and
  pushes them to the printer (same API contract, see §6). Build the bridge as a separate process from day one
  even if it initially runs on the same box as Next.js.

## 2. Machines in scope: "estimate sets the price, the meter tells the truth"

Every gated tool except the A1s sits behind a **Shelly** device with power metering (local HTTP RPC + MQTT, LAN only,
no cloud). The Shelly does two things: **switch** (power only flows while a released job/session is open) and
**meter** (watts every second, so the portal records what actually ran). The phone is the badge: a QR on each tool
opens `/jobs/new?machine=<id>`.

| Tool | Hardware | Lock | What the meter records |
|---|---|---|---|
| Bambu A1 ×4 | none needed | file-level: portal sends the 3MF (Developer Mode) | progress via MQTT; Shelly optional |
| xTool laser | Shelly Plus 1PM (or Plus Plug US) | switched ON at release | real cut minutes = time above `idleWatts` |
| CNC router | Shelly Plus 1PM on controller + spindle circuit | switched | real spindle minutes |
| Plasma table | Shelly Plus 1 driving a 240V contactor + Shelly Pro EM clamp | switched via contactor | real arc-on minutes |
| Resin (Saturn) | Shelly Plus Plug US | switched | print duration, logged against typed grams |
| Sawgrass sublimation | Shelly Plus Plug US, **relay pinned ON** (cross-check only) | PC agent pauses the Windows printer until a session is open; **page counts from the print spooler** auto-charge (see 2b) | print events as a sanity check |
| SawStop / planer / jointer (cert-required, no charge) | Shelly Plus 1PM or Pro 4PM at the panel | switched; member taps **Start** on phone after cert check | who ran what, when, for how long |
| Sewing, vinyl, hand tools | — | — | — |

### Metering rules (`src/lib/jobs/metering.ts`, pure, tested)
- `MachineMeterProfile { machineId, idleWatts, activeWatts, minEventSeconds }` per tool; seed guesses, tune from data.
- **Active minutes** = seconds with watts > `activeWatts`, summed, ÷ 60, rounded up to the rate's `roundingMinutes`.
- **Events** = contiguous runs above `activeWatts` lasting ≥ `minEventSeconds` (Sawgrass: one event ≈ one print).
- Charge on release from the estimate (§4). After the job closes, if `activeMinutes > estMinutes × 1.10 + 5`,
  post an **adjustment** line for the difference at the same rate and e-mail the member; staff can void it.
  Under-runs are never auto-refunded.
- Sawgrass: `pagesLogged` (spooler) vs `eventsCounted` (meter) shown in `/admin/jobs`; a gap > 1 flags the job.

### Safety rules (non-negotiable; put them in the bridge, not the UI)
1. **Never switch a tool off while it is drawing working current.** When an estimate expires, wait for watts < `idleWatts`
   for 60 consecutive seconds, then switch off. A laser cut or CNC pass is never killed mid-job.
2. Idle auto-close: session open and watts < `idleWatts` for 15 min → close session, switch off (except pinned-on tools).
3. Pinned-on tools (`neverSwitchOff: true`, Sawgrass): the bridge refuses any OFF command; metering only.
4. Bridge offline or Shelly unreachable → fail **closed** for switched tools (no power without a confirmed job) but
   log loudly; staff override from `/admin/jobs` can force a tool ON for a set time.
5. Plasma and anything 240V: Shelly drives a contactor; never switch the load through a plug.

### 2b. xTool and Sawgrass in detail

**xTool laser.** Member types the minutes XCS shows before "Process", confirms; Shelly turns ON for
`estMinutes + 10`, then follows the safety rules above. Boot + re-home takes ~1 min, hence the buffer. Later:
`.xcs` upload + parse, and locking the shop laptop behind the portal kiosk so XCS cannot open without a job.

**Sawgrass.** Per print, captured from the **Windows print spooler**, not typed and not from the meter.
Sawgrass Print Manager prints through a normal Windows printer, so the shop-PC agent (§2c) subscribes to the
`Microsoft-Windows-PrintService/Operational` log (event **307** "document printed": document name, user, printer,
**pages printed**) or WMI `Win32_PrintJob`. On each event it posts `POST /api/agent/print { deviceId, sessionId,
pages, documentName, printedAt }`; the server creates a `MachineJob { source: "spooler" }` and charges `pages × rate`
(member $2.50 / nonmember $4.00 per 8.5×11) **automatically**, credit first. No count is typed.

Lock: the agent **pauses the Windows printer** whenever no session is open and resumes it when one opens; jobs
queued while locked just wait. Nonmembers: agent holds each job, overlay shows "5 pages — $20.00 — Confirm", release
on confirm/paid. Members: release immediately, charge posts. Jams/misfeeds are counted (Windows logged the pages);
staff refund from the job page. The Shelly on the Sawgrass stays **pinned ON**; its print-event count is a
cross-check column in `/admin/jobs` (`pagesLogged` vs `eventsCounted`), not the source of truth. Never power-cycle it.

### 2c. Sessions and the shop-PC agent (who is using the machine)

The Shelly never knows *who*; the **server** does. Every tool is used inside a `MachineSession { userId, machineId,
openedAt, closedAt, openedVia: "portal_job" | "pc_agent" | "phone", jobId? }`. Meter samples that arrive while a
session is open are attributed to it; samples with no open session are flagged `unattributed` (someone bypassed the
lock, or the PC agent is down) and shown on `/admin/alerts`.

Three front doors, one session model:
1. **Portal job** (A1s): `confirm` opens the session; bridge closes it on print done/failed.
2. **Shop-PC agent** (xTool, CNC, Sawgrass, resin): a small agent (`agent/`, Electron or .NET, Windows) runs on each
   machine PC, which auto-logs into a locked-down Windows account. The agent shows a full-screen **"Sign in to The
   Box"** overlay until a session exists. Sign-in = portal credentials or a QR the member scans with their phone
   (`/device/<code>` device-code flow, like signing in to a TV). Server runs the §3 checks, opens the session,
   switches the Shelly ON, and the overlay drops. The agent polls `GET /api/sessions/current?deviceId=` every 5 s and
   re-locks when the session closes. It also posts the foreground app name (`XCS`, `SawgrassPrintManager`) with each
   heartbeat as a secondary usage signal. Sign-out button on the overlay; idle rule (§2 safety #2) closes it too.
   For per-minute tools the agent asks for the estimate at sign-in (this is the §4 quote); for the Sawgrass nothing is
   asked — the spooler reports pages and the charge posts automatically (§2b).
3. **Phone** (SawStop, planer, jointer; no PC): QR → `/machines/<id>/start` → checks → session → Shelly ON. **Stop**
   button or idle rule closes it.

Agent API (`src/app/api/agent/`): `POST /api/agent/heartbeat { deviceId, foregroundApp, loggedIn }`,
`POST /api/agent/print { deviceId, sessionId, pages, documentName, printedAt }`, and `GET /api/sessions/current`. Agent auth uses a per-device token (`Device.authSecret`), not the reader secret.

## 3. The checks (all must pass before a job is released)

Reuse `evaluateMachineAccess()` in `src/lib/data/access.ts` — do not write a second gate. Add a
`"job"` variant that skips the badge checks. Order and deny reasons:

1. User logged in (next-auth) → else `login_required`
2. `user.status === "active"` → `user_inactive`
3. `user.shopAccess` true (Friend tier has none) → `no_shop_access`
4. Current waiver version signed → `waiver_outdated`
5. Every id in `machine.requiredCertificationIds` has an active `UserCertification`
   (`checkedOffAt` set, not revoked, not expired; `knowledgeOnly` certs may pass on `knowledgePassedAt`)
   → `missing_certification` (include which one so the UI can link to the Learn module)
6. Machine active and no `MaintenanceBlock` overlapping now → `machine_inactive` / `maintenance`
7. If `machine.reservationRequired`: an overlapping booked reservation by this user → `reservation_required`
8. Estimate present and parsed (minutes > 0) → `estimate_missing`
9. Price shown and member clicked **Confirm & run** → otherwise job stays `quoted`
10. Member not over their balance-owed cap (`OrgSettings.maxBalanceOwedCents`, default $50) → `balance_owed`

Day-pass users are `User` rows with `tier = "day-pass"` and `dayPassCreditExpiresAt > now`; they pass
step 2–3 while the pass is valid and are charged nonmember rates. Staff/admin can run any machine
for $0 with a reason (`staffOverride` on the job) — log it.

## 4. Pricing (member vs nonmember)

Rates are rows in a `MachineRate` table, editable at `/admin/rates`. Seed with these. **DRAFT — James
confirms the TBD cells.** "Nonmember" = day pass / class attendee / anyone without a shop-access tier.

| Machine | Unit | Member | Nonmember | Minimum |
|---|---|---|---|---|
| Laser (xTool) | per hour, 5-min increments | **$15.00** | $22.50 | $5.00 member / $11.25 nonmember (30 min) |
| Bambu A1 (FDM) | per gram of filament (from 3MF) | **$0.0156** (1.56¢/g) | $0.0234 (2.34¢/g) | $1.00 member / $10.00 nonmember |
| Resin (Saturn) | per gram/mL of resin | TBD (≈4.6¢/g if resin is $35/kg) | 1.5× member | $2.00 / $10.00 |
| CNC router | per hour, 5-min increments | TBD | 1.5× member | 15 min member / 30 min nonmember |
| Plasma table | per hour, 5-min increments | TBD | 1.5× member | 15 min member / 30 min nonmember |
| Sublimation + heat press | per 8.5×11 print | $2.50 | $4.00 | 1 print |
| Woodshop, sewing, vinyl, hand tools | — | included | included w/ day pass | — |

Default nonmember rate = 1.5 × member rate unless a row overrides it. Minimums: member minimums stay low ($5 laser, $1 FDM, $2 resin, 15 min CNC/plasma); nonmember minimums are doubled ($11.25 laser, $10 FDM, $10 resin, 30 min CNC/plasma). FDM example: 668 g → $10.42 member.

### Membership tiers (what the billing engine needs to know)

| Tier (`MembershipProduct.tier`) | Price | shopAccess | Monthly machine credit | Notes |
|---|---|---|---|---|
| `friend` | $10/mo | no | — | cannot submit jobs |
| `community` | $20/mo | yes | $10 | member rates |
| `maker` | $40/mo | yes | $10 | member rates |
| `patron` | $60/mo | yes | $10 | member rates (extra $20 is a donation) |
| `maker-plus` | $75/mo | yes | **$50 flex credit**, rolls over to $100 cap | spends on machine time **or** classes. Stored as tier slug `maker_pro` |
| `unlimited` | $120/mo | yes | unlimited | every job prices to **$0** (still logged, still gated) |
| `day-pass` | $20 one-time | while valid | — | **nonmember rates** |
| household add-on | +$20/mo per adult | inherits | shares primary's credit | `householdPrimaryUserId` |

`maker-plus` uses the existing `MembershipProduct.tier` slug `maker_pro` (the $75 Maker Pro product). Seed its credit and rollover cap on that row; do not add a second product.

### Billing rules

1. Compute `listCents` from the rate × estimate, rounded up to the unit (time → next 5 min; grams → whole gram), then apply the minimum.
2. Unlimited → `chargedCents = 0`, `creditAppliedCents = 0`.
3. Otherwise draw from the member's current-month credit balance first (`creditAppliedCents`), remainder is `chargedCents`.
4. Credit resets on the member's billing anniversary; Maker+ unused credit rolls over up to $100 total. Credit ledger is a table (`CreditLedger`), not a column, so every grant/spend/expiry is auditable.
5. **Charge on release**, not on completion. The member agreed to the estimate; if the job fails or is cancelled, staff can refund part or all (`refundCents`, `refundReason`) from the job page. No automatic refunds — a failed print still used filament.
6. If the machine runs longer than the estimate (CNC/laser), nothing extra is charged in v1. Staff can add an adjustment line. Revisit once we have data.
7. `chargedCents > 0` accumulates on `User.balanceOwedCents`. Settlement is outside this feature for v1: a monthly statement e-mail, paid by Zeffy/Stripe link, and staff mark it paid in `/admin/billing`. (Stripe auto-charge is phase 3.)
8. Household members draw from the primary's credit and post charges to the primary's balance.
9. Nonmembers must pay before release: v1 = staff marks "paid at desk" on the job; no release until paid.

## 5. Data model (Prisma additions — do not break the existing badge tables; Badger stays as a fallback)

```prisma
model MachineRate {
  id               String   @id @default(cuid())
  machineId        String   @unique
  machine          Machine  @relation(fields: [machineId], references: [id])
  unit             String   // "minute" | "gram" | "print"
  memberCentsPerUnit     Float  // per minute / gram / print; fractional ok (FDM = 1.56), totals round to the cent
  nonmemberCentsPerUnit  Float? // null => 1.5 × member
  memberMinimumCents     Int    @default(0)
  nonmemberMinimumCents  Int    @default(0)
  roundingMinutes        Int    @default(5)
  updatedAt        DateTime @updatedAt
}

model MachineJob {
  id            String   @id @default(cuid())
  userId        String
  machineId     String
  status        String   // quoted | awaiting_payment | released | running | done | failed | cancelled
  source        String   // "3mf" | "typed" | "staff"
  fileName      String?
  filePath      String?  // server-side storage path, never public
  estMinutes    Int?
  estGrams      Float?
  estUnits      Float?   // generic (prints, mL)
  listCents     Int
  creditAppliedCents Int @default(0)
  chargedCents  Int
  refundCents   Int      @default(0)
  refundReason  String?
  rateSnapshot  Json     // the MachineRate row at quote time
  denyReason    String?  // last failed check, for UX
  staffOverride Boolean  @default(false)
  overrideNote  String?
  releasedAt    DateTime?
  startedAt     DateTime?
  endedAt       DateTime?
  printerSerial String?
  printerProgress Int?   // 0–100 from MQTT
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([userId, createdAt])
  @@index([machineId, status])
}

model CreditLedger {
  id        String   @id @default(cuid())
  userId    String
  deltaCents Int     // + grant, − spend/expiry
  kind      String   // grant | spend | rollover | expire | adjust
  jobId     String?
  note      String?
  periodKey String   // "2026-10" billing period
  createdAt DateTime @default(now())
  @@index([userId, periodKey])
}

model Printer {              // one per A1
  id          String  @id @default(cuid())
  machineId   String  @unique
  serial      String  @unique
  host        String  // LAN IP or mDNS
  accessCode  String  // keep encrypted at rest; never returned by any API
  model       String  @default("A1")
  lastSeenAt  DateTime?
  state       String? // idle | printing | error | offline
}
```

Also: `UsageSession.badgeId` → optional; add `jobId String?`. `User.balanceOwedCents Int @default(0)`.
`MembershipProduct`: add `monthlyCreditCents Int @default(0)`, `creditRolloverCapCents Int?`, `unlimitedMachines Boolean @default(false)`.
`OrgSettings`: `maxBalanceOwedCents Int @default(5000)`, `nonmemberMultiplier Float @default(1.5)`.

## 6. API

All under `src/app/api/jobs/`. Session auth via next-auth; printer-bridge endpoints use `READER_SHARED_SECRET` exactly like `src/lib/access-api.ts`.

- `POST /api/jobs/quote` — multipart `{ machineId, file? , estMinutes?, estUnits? }` → parses 3MF if present, runs checks §3 (1–8), prices (§4), creates `MachineJob(status: quoted)`, returns `{ jobId, checks[], estimate, listCents, creditAppliedCents, chargedCents, denyReason? }`. Never releases.
- `POST /api/jobs/:id/confirm` — member confirms; re-runs checks; if nonmember and unpaid → `awaiting_payment`; else posts charge + ledger spend atomically (`prisma.$transaction`), sets `released`, creates `UsageSession`. For A1s, enqueues for the bridge.
- `POST /api/jobs/:id/cancel` — before release only (member); staff anytime with refund.
- `GET /api/jobs/:id` — status/progress for the job page (polls every 5 s while running).
- Bridge (shared secret): `GET /api/jobs/bridge/next?printerSerial=` → next released job + signed one-time download URL; `POST /api/jobs/bridge/status` `{ jobId, state, progress, error? }` → updates job + `Printer.state`, closes `UsageSession` on done/failed.
- Staff: `POST /api/jobs/:id/refund`, `POST /api/jobs/:id/mark-paid`, `POST /api/jobs/:id/override`.

## 7. UI

- `/jobs/new` — pick machine (only ones the member is certified for are enabled; others show "Get certified →" link to `/learn`), drop 3MF or type estimate, see check results as a list with ✓/✗, see price breakdown (list / credit / you pay), **Confirm & run**.
- `/jobs/:id` — status card: queued / sending / printing 42% / done, cancel button, receipt.
- `/usage` (exists) — add the job history with cost columns and running credit balance.
- `/admin/rates` — edit `MachineRate` rows. `/admin/jobs` — all jobs, filters, refund/mark-paid/override. `/admin/printers` — add A1 (serial, host, access code), online status.
- `/dashboard` — credit remaining this month and balance owed.

## 8. 3MF parsing (`src/lib/jobs/parse-3mf.ts`)

Unzip (use `fflate` or `adm-zip`), read `Metadata/slice_info.config` (XML: `<metadata key="prediction" value="SECONDS"/>`, `<metadata key="weight" value="GRAMS"/>` per plate) and fall back to the `; estimated printing time` / `; total filament weight` comment lines in `Metadata/plate_1.gcode`. Sum across plates. Reject files with no plate gcode ("Please slice before exporting — File ▸ Export ▸ Export plate sliced file"). Max upload 200 MB. Store under `storage/jobs/<jobId>.3mf` outside `public/`.

## 9. Device bridge (`bridge/` — Node, separate process on the shop LAN)

Per printer: FTPS to `host:990` (user `bblp`, password = access code) to upload the 3MF; MQTT over TLS to `host:8883` (`device/<serial>/request`, `print.command: "project_file"`), subscribe to `device/<serial>/report` for `mc_percent`, `gcode_state`. Post status back via §6. Poll portal every 5 s. Keep the Bambu-specific code behind a `PrinterDriver` interface so Prusa/others can be added.

**Shelly driver** (`bridge/drivers/shelly.ts`): Gen2+ RPC over local HTTP (`/rpc/Switch.Set?id=0&on=true`,
`/rpc/Switch.GetStatus` → `apower`, `aenergy`) or subscribe to the device's MQTT `status` topic; poll at 1 Hz while a
session is open, 0.1 Hz otherwise. Add `Device { machineId, kind: "shelly"|"bambu", host, authSecret?, neverSwitchOff }`
(replaces the `Printer` model; keep `serial`/`accessCode` as optional fields). Bridge posts `MeterSample { deviceId, at, watts }`
in 10-second batches to `POST /api/jobs/bridge/meter` and the portal derives active minutes / events with `metering.ts`.
Shelly devices get a static DHCP lease, device auth password set, and cloud disabled.

## 10. Build order (each is a PR)

1. Prisma models + migration + seed rates and tier credits; `src/lib/jobs/pricing.ts` pure function + tests (**already added, see that file**).
2. 3MF parser + tests with a real A1 3MF fixture under `tests/fixtures/`.
3. `MachineSession` + `quote` + `confirm` + job page UI + phone Start/Stop; checks via `evaluateMachineAccess` job variant. Typed-estimate machines work end-to-end here (charge only, no relay).
4. Bridge + printer admin; one A1 in LAN-only + Developer Mode on the bench. Verify the lock: Bambu Studio on a member laptop cannot find/send to the printer.
5. Credit ledger monthly roll + `/usage` history + statements.
6. Shelly driver + `metering.ts` + adjustments + shop-PC agent (overlay, device-code sign-in, heartbeat); laser first, then CNC, Saturn, Sawgrass (meter only), woodshop tools.
7. Stripe auto-settlement.

## 11. Open questions for James (do not block on these; use the defaults)

- CNC, plasma, resin member rates (TBD above). Nonmember = 1.5× unless told otherwise.
- Is nonmember FDM really 1.5× per gram, or a flat $5 minimum + member rate?
- Confirm all four A1s are on firmware ≥ 01.05 (Developer Mode requires it) and that losing Handy is acceptable.
- Where will the portal be hosted — on-site (no bridge needed) or Vercel (bridge on shop PC)?
- Badger is retired as a machine gate; keep the ESP32 code only if we want a door reader later.
- Electrician needed for the plasma contactor and any panel-mounted Shelly Pro 4PM; plugs (xTool, Saturn, Sawgrass) are DIY.
