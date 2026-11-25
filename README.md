# The Box Portal

Member-facing web app and back office for **The Box**, the community makerspace run by Discover Burien (Burien, WA).

## Status

**Live** at `https://discoverburienmakerspace.com` on Cloudflare Workers + D1 (Workers Paid plan). Local `next dev` still runs on fixtures.

**Phase 5:** Prisma schema + seed, PrismaDataProvider, Auth.js magic links, Google Drive CMS sync scaffold, Docker Compose (Mailpit), Vitest, Playwright smoke tests.

**Phase 4:** staff admin + `/dev/reader`  
**Phase 3:** classes, reserve, learn/quizzes  
**Phase 2:** onboarding, dashboard, account, certifications, usage  
**Phase 1:** shell, fixtures, public pages  

## What staff edit without a developer

The rule: how the site looks is code; what it says is edited in the admin. Everything below saves to the live database.

| What | Where |
|---|---|
| Waiver, policies, FAQ, history, staff intro, support and lesson text; holiday closures and other notes about hours | Admin → Content (rich-text editor; a new waiver version asks every member to sign again) |
| Opening hours, day by day | Admin → Settings → Opening hours |
| The explanatory text on Join, Support, Wishlist, Staff, History, Events, Bounties, Volunteer, Equipment, Made here, a class page and Reserve | Admin → Content → Text on pages. Each piece starts with its built-in wording (`src/lib/data/text-blocks.ts`) and can go back to it |
| Machines (incl. attended-only, longest booking, order) and certifications (incl. what each covers, prerequisites, order) | Admin → Machines, Admin → Certifications (switched-off ones stay listed) |
| Classes: details, description, cancel or restore; add a member or cancel a booking | Admin → Classes (lists drafts, cancelled and past classes too). Cancelling moves no money: Zeffy refunds are made in Zeffy |
| Learning modules: details, pass mark, attempts, equipment confirmed; lessons and their text; videos; quiz questions with one or several right answers | Admin → Learn → a module. Removing a lesson takes its videos and the watch and progress records with it; certifications members hold are untouched |
| Staff and instructor directory | Admin → People |
| "Made at the makerspace" gallery | Admin → Gallery |
| Wishlist items, purchase reports | Admin → Wishlist |
| Lobby display photos, promos and settings | Admin → Display |
| Shop name, address, footer text, social links, checkout links, limits | Admin → Settings |
| Machine rates: laser, CNC and plasma per hour, minimums, plasma setup fee and its last-weekend waiver, filament cost and markup, sublimation per print, run-time rounding | Admin → Settings → Machine rates |
| A member's membership, shop access, staff note, and (admins only) role; registering a badge for them and switching a lost one off | Admin → Members → a member |
| Volunteer roles and what each involves | Admin → Volunteers → Roles |
| Bounty board requests: fix the wording, hide, reopen, remove spam | Admin → Bounties |
| Shared PCs and their software: edit, retire a PC, switch a program off | Admin → Workstations (a retired PC's kiosk screen says it is switched off) |
| Maintenance blocks: change or remove | Admin → Reservations → Maintenance blocks |
| Maintenance blocks: schedule or change one as a Shop Steward who is not staff | `/maintenance` |
| Inventory areas (rename, switch off) and who stewards each | Inventory → Areas |
| Gift cards and promo codes | Admin → Codes |
| Which page shows under the hours on Join and which policy new members agree to; the every-safety-question quiz rule | Admin → Settings |
| Shop inventory with photos | Inventory → Add item |
| Which inventory items the public Equipment page lists | Inventory → an item → Edit → "Show on the public Equipment page" (on by default) |

Lists with no table of their own (directory, gallery, wishlist, shop details, machine rates, tool champion terms) are rows in `SiteRecord`, one JSON row each (`src/lib/data/persist-delta.ts`). Lobby promos, display settings and lobby photos have tables of their own (see Lobby display). Inventory and gallery pictures are rows in `StoredFile`, because a Worker has no disk; set `INVENTORY_PHOTO_STORAGE=drive` to send new photos to a Google shared drive instead (`src/lib/inventory/storage.ts`).

The opening hours are one stored week (`SiteRecord` row `openingHours:default`; `src/lib/opening-hours.ts` holds the default and the rules). The lobby display's "Open now", the hours a machine can be reserved in and the list on the Join page are all worked out from it, on the hour or the half hour. The Hours page under Admin → Content shows beneath that list and is for anything extra.

Still in code: page headings, button labels and the messages built from data (dashboard notices, quiz results, booking confirmations), which machines are included with membership and which bill by time, gram or print (`src/lib/credits.ts`), and the class-category and machine-area lists. To make another paragraph editable, add it to `TEXT_BLOCKS` and draw it with `<TextBlock slug="…" />`.

## The public Equipment page

`/equipment` shows two lists, for anyone, signed in or not:

- **In the shop**: the inventory, grouped by inventory area, each item with its front photo, name, make and model. An item appears once staff or its area's steward approve it in Inventory → Review. It is left off when it is retired, missing, broken, or switched off with "Show on the public Equipment page" on the item's edit form. An item that needs repair still shows, with no condition label.
- **Machines to reserve**: the machines from Admin → Machines, each linking to its page with certifications and reservations. The two lists are kept separately, so a machine that is also in the inventory shows in both.

A visitor gets only the name, manufacturer, model, a quantity when there is more than one, the area, and the front photo. Never the serial number or the serial-plate photo, the storage location, notes, donor, value, asset tag or who added it. `listPublicEquipment` in `src/lib/data/mock-provider.ts` builds that view by picking fields, and `src/lib/data/public-equipment.test.ts` fails if a new field reaches it unnoticed. Photos are served from `/api/inventory/photos/…` by their storage key, which is random and is only published for the front photo of a listed item.

## Redemption codes

Gift cards and promo codes. Staff make them under Admin → Codes, one at a time or up to 50 to print; the person signs in, opens **Redeem a code** (`/redeem`) and types it. A code works once.

| Kind | What redeeming does |
|---|---|
| Shop credit | Adds the amount to the member's shop credit (ledger kind `gift_code`), which pays for machine time and classes. |
| Membership | Sets the tier, makes the member active, and sets `User.membershipEndsAt` that many months out. The hourly cron (`src/lib/memberships/lapse.ts`) lapses them when it passes. A Zeffy membership payment clears the date. A second code for the same tier adds to a membership that is still running. Someone already paying through Zeffy is sent to staff and the code is not used up. |
| A class | One named class, or any one class up to a price. The person picks the class; the code grants that class's price as credit and the ordinary booking and pay-with-credit run, so seats, cancelling and refunds follow the usual rules. If the booking is refused, nothing is granted and the code stays unused. |

- **Exactly once.** Two requests can both load a code as unused. Before anything is saved, the request claims the code with one conditional write (`updateMany` where it is still unredeemed and unvoided, `createPersistingProxy` in `src/lib/data/prisma-provider.ts`); the one that changes no row is refused. The credit row's id comes from the code (`cl-code-<id>`), so a repeated save cannot add it twice. If the save fails twice after a claim, the code stays held for that person and Admin → Codes shows it as claimed but not finished, for staff to settle by hand; it is never handed to someone else.
- **The code itself** is 15 characters from 31 (no 0, O, 1, I or L), about 74 bits, printed as `XXXXX-XXXXX-XXXXX` and accepted in any case with or without dashes (`src/lib/redemption-code.ts`). Checking and redeeming are limited to 10 a minute per member (`RL_REDEEM_CODE`).
- **Privacy.** Only staff can list, make or void codes. A member learns only what the code they typed gives; an unknown code and a voided one get the same answer. Codes are not written to the audit trail or the logs.
- **Expiry** is optional and off by default. Washington generally does not allow a gift card someone paid for to expire; use it for free or promotional codes.
- **Printed gift cards.** Tick "Number these as gift cards" when making a batch and each code gets a short card number (001, 002, …), unique in the database. The card carries only that number; the print view is the staff record of which code is behind which card. The holder brings the card in and staff redeem it for them from Admin → Codes (find the card, **Redeem for a member**) or from the member's page (**Redeem a gift card**): the same rules and the same single claim as a member's own redemption, with the staff member recorded. Someone who has never signed in can be added on the spot with a name and email; signing in later with that email finds the same account. A card number never works on `/redeem`: it is short enough to guess, so only staff can redeem by it.
- **Gift cards sold through Zeffy:** nothing is automatic yet. When the payment arrives, make a code with the Zeffy payment ID in its form and send it to the buyer.

## Local development (mock UI — default)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Dev · Switch user** at the bottom. That toolbar and the fixture data are for local work only. They are not part of the live site.

Local quick share while your laptop is on (temporary):

```bash
npx cloudflared tunnel --url http://localhost:3000
```

## Production: Cloudflare Workers + D1

Live at `https://discoverburienmakerspace.com` (the Worker's default `thebox.james-trey-young.workers.dev` address also works but is not the canonical one — sessions are per hostname, so always link to the root domain). Deploys from `main` through Cloudflare Workers Builds (Workers & Pages → thebox → Settings → Build). A pull request gets its own preview deployment.

- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `bash scripts/cf-deploy.sh` — applies `migrations/*.sql` to the `thebox-db` D1 database, optionally seeds, then deploys the OpenNext bundle.
- Config: `wrangler.jsonc` (Worker name, D1 binding `DB`, plain-text vars). Secrets live in the dashboard under Settings → Variables and Secrets: `AUTH_SECRET`, `AUTH_RESEND_KEY`, `ZEFFY_API_KEY`, `ZEFFY_WEBHOOK_SECRET`, `DISPLAY_TOKEN`, `READER_SHARED_SECRET`.

**Database.** Prisma uses `@prisma/adapter-d1` on Workers (`src/lib/db.ts`); in Node scripts it falls back to `DATABASE_URL`. D1 runs `$transaction` as plain sequential queries. The schema is still `prisma/schema.prisma`; D1 gets it through `migrations/`:

1. Edit `prisma/schema.prisma` and push. The `db-artifacts` GitHub workflow rebuilds a scratch DB from the existing migrations, diffs it against the schema, and commits the next `migrations/NNNN_*.sql` plus a refreshed `prisma/seed-data.sql` to your branch.
2. Merge. The deploy applies the new migration before the Worker is published.

**Seeding production once.** Add a build variable `SEED_D1=1` (Settings → Build → Variables), deploy, then remove it. `seed-data.sql` uses `INSERT OR IGNORE`, so it never overwrites edits made in the portal.

**Sign-in email.** Workers have no SMTP, so production uses the Resend provider when `AUTH_RESEND_KEY` is set (`src/lib/auth/email-provider.ts`). SMTP through Nodemailer/Mailpit is for `next dev` only: it is a dev dependency and is left out of production builds, where a missing key fails the sign-in with a clear error instead.

## Classes & calendar

Zeffy is where a class is created. An hourly Worker cron (`src/worker.ts`) pulls event campaigns into `ClassSession` and pushes them to Google Calendar. Paid events go to the classes calendar. Free events, and classes created in the portal, go to the community calendar. Sheet-imported rows (`source = csv`) are not pushed.

1. Create a Google Cloud service account, enable the Calendar API, and store the JSON key as the secret `GOOGLE_SERVICE_ACCOUNT_JSON`.
2. In the discovermakers Google Calendar, share **box classes** and **community classes** with the service-account email as **Make changes to events**. Copy each calendar id into `GOOGLE_CALENDAR_CLASSES_ID` and `GOOGLE_CALENDAR_COMMUNITY_ID`.
3. Delete the hand-entered Nov/Dec events on those calendars (or retire the calendars and create fresh ones). The sync never edits an event that it did not create.
4. Recreate the Nov/Dec classes in Zeffy (ticketed when paid, free RSVP for make nights). In the portal, set **Default class instructor** under Admin → Settings, then use **Sync from Zeffy now** on Admin → Classes. Confirm the calendar.
5. After that deploy, mark the old sheet rows once:

```bash
npx wrangler d1 execute thebox-db --remote --file=scripts/one-off/mark-csv-class-sessions.sql
```

Then use **Archive CSV-imported sessions** so the public classes page only shows Zeffy classes.
6. Embed the Google Calendar on the Discover Burien Squarespace “Makerspace Classes” page.

`SYNC_SECRET` lets a caller `POST /api/sync/zeffy` without a staff session. The cron calls the sync directly and does not need it.

## Prisma (SQLite)

```bash
cp .env.example .env   # set AUTH_SECRET, DATABASE_URL=file:./dev.db
npm run db:push
npm run db:seed
```

- Schema: `prisma/schema.prisma` (mirrors fixtures; SQLite in dev)
- Seed: `npm run db:seed` loads `data/mock/*.json`
- Provider: `createPrismaDataProvider()` when `DATA_PROVIDER=prisma` (see `src/lib/data/factory.ts`)

| Mode | What to set | What the browser uses |
| --- | --- | --- |
| Local `next dev` | leave both unset | Fixtures and the Dev toolbar, for building only |
| Live site | production build on Cloudflare. Optional: `DATA_PROVIDER=prisma` and `NEXT_PUBLIC_DATA_MODE=live` | Auth.js session and D1. A production build does this by default. |

`/workstation` and `/api/me` talk to Prisma directly (incremental upserts — no full-table wipe). The lobby display keeps using `/api/display/feed`.

## Workstation (shared Windows PCs)

`/workstation?device=BOX-PC-1` is the kiosk UI (no public header/footer/Dev toolbar). PIN or phone QR logs in the same `User` row. Magic links stay for home use.

Login is **identity + which software you may open**. Sitting at a desk URL does not start a clock or debit credits. Charge when a **job is sent** (estimate shown first).

The prices are the shop's rate card, edited under Admin → Settings → Machine rates and kept in the database (`SiteRecord` row `rateCard:default`; `src/lib/rate-card.ts`). The numbers below are the defaults, which apply until staff save their own. 3D: grams × (filament $/kg × 1.30 / 1000), default ~$12/kg PLA → ~1.56¢/g, min $1 member / $5 nonmember. Laser/CNC: estimated run time rounded up 5 min (member/nonmember rates). Plasma: the same, plus a $50 setup fee that is waived on the last weekend of the month. Sublimation $1/$2 per print. Vinyl, woodshop, sewing, hand tools: included, and not on the card. Unlimited: log the job at $0 machine time. The server prices every job itself from the card (`src/lib/workstation/jobs.ts`); the desk only sends grams, minutes or prints. A changed rate applies from the next job sent, and jobs already sent keep what they were charged. `Machine.hourlyRateCents` is not read by billing. Prints and spooler jobs are not cancelled on logout.

Tauri 2 shell: `apps/workstation-shell/` (autostart, Credential Manager, launch mapped `.exe`s after `POST /api/workstation/launch`).

Seeded demo PIN for active fixture members: **2468**. Maya: `maya.chen@example.com`.

## Auth.js magic links

```bash
npm run docker:mail          # Mailpit UI http://localhost:8025  SMTP :1025
# AUTH_EMAIL_SERVER=smtp://127.0.0.1:1025 in .env
```

- `/login` — request magic link  
- Fixture emails (e.g. `maya.chen@example.com`) match seeded users after `db:seed`  
- Dev toolbar still works without Auth for UI review  

## Content sources (who owns what)

| Content | Source of truth | How it gets in |
|---|---|---|
| Class schedule + catalog | Google **Sheet** (`The_Box__Winter_2026_Classes__Schedule`) | `node scripts/import-winter-schedule.mjs` (CSV export → `data/mock/class-sessions.json`). Live Sheet API sync is a later step. |
| Waiver, hours, policies, learning copy, FAQ | Google **Drive** Docs in `The Box Website/Content/` | `npm run sync:google` → `ContentPage` |
| Event flyers, Made-here gallery, lobby promo images | Google **Drive** folders `Flyers/`, `Photos/` | `npm run sync:google` → `public/` |
| Tickets and payments | **Zeffy** | `npm run sync:zeffy` + webhook (see below; not part of the Drive CMS) |
| Notion | **Deprecated** | `scripts/sync-notion.ts` is kept for reference only; no new content goes there |

Staff edit Docs and drop files in Drive with normal Drive sharing. No developer needed to change wording.

## Google Drive CMS

```bash
npm run sync:google              # full sync (Docs → ContentPage, Flyers/Photos → public/)
npm run sync:google -- --dry-run # preview only
npm run sync:google -- --content # Docs only
npm run sync:google -- --media   # Flyers/Photos only (no database needed)
```

Without `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_DRIVE_FOLDER_ID`, the script prints the setup steps and exits 0 (safe for CI). Nothing in the app blocks on Google being configured — local fixture copy in `data/mock/content` keeps `next dev` working.

### Drive folder layout (staff-facing)

Create one shared folder, **The Box Website**:

```
The Box Website/
  Schedule / Class Catalog   ← existing spreadsheet (classes stay here for now)
  Content/                   ← Google Docs, one per page
    Waiver                   ← slug "waiver"; rename to "Waiver v2026.2" to bump the version members must re-sign
    Hours                    ← slug "hours"
    Policies/                ← one Doc per policy page (Member Expectations, Storage & Abandoned Property, …)
    Learning/<Module>/       ← lesson copy, e.g. Learning/3D Printing/Materials → slug "3d-printing-materials"
    Volunteer/  Classes/  FAQ/  ← optional; folder name = category
  Content Index              ← optional Sheet: slug | title | category | doc | published | version
  Flyers/                    ← event flyer PDFs or images → /uploads/flyers/…
  Photos/
    Made here/               ← gallery images → /images/projects/…
    Promos/                  ← lobby display images → /uploads/promos/…
```

- **Category** comes from the subfolder under `Content/` (`Policies` → `policy`, `Learning` → `lesson`, `Volunteer`, `Classes`, `FAQ`). Docs directly in `Content/` named `Waiver`, `Hours`, or `FAQ` map to those fixed slugs; any other root Doc is treated as a policy page.
- **Slug** is the Doc title, slugified (`Member Expectations` → `member-expectations`). Renaming a Doc keeps the same page — pages are keyed on the Drive file id (`ContentPage.googleFileId`).
- **Version** only changes when you say so: add ` v2026.2` to the Doc title or fill the `version` column in the Content Index. Everything else (typo fixes) keeps the version, so members are not asked to re-sign the waiver for a comma.
- **Content Index sheet** (optional) overrides the folder rules per Doc: columns `slug | title | category | doc (id or URL) | published (yes/no) | version`. Use it to unpublish a page without deleting the Doc, or to point at a Doc that lives elsewhere in Drive.
- A Doc removed from `Content/` is **unpublished**, not deleted, on the next sync.
- Media folders are flat (subfolders are skipped). Google Docs/Slides dropped into `Flyers/` export as PDF. Each synced folder gets a `drive-manifest.json` listing file → Drive id, modified time, and the file's Drive **Description** (use it for captions / alt text). Unchanged files are not re-downloaded.
- Formatting that survives from Docs: headings, bold/italic/underline, lists, links, tables, images. Everything else (fonts, colors, spacing) is dropped so pages match the site. Images pasted into a Doc are hot-linked from Google; prefer putting images in `Photos/`.

### One-time Google Cloud setup

1. [Google Cloud Console](https://console.cloud.google.com/) → new or existing project.
2. Enable the **Google Drive API**.
3. **IAM & Admin → Service accounts → Create**, then **Keys → Add key → JSON** and download it.
4. In Drive, share **The Box Website** with the service-account email (`…@….iam.gserviceaccount.com`) as **Viewer**.
5. Copy the folder id from its URL (`drive.google.com/drive/folders/FOLDER_ID`).
6. Set env (local `.env`, and Cloudflare → Settings → Variables and Secrets):

| Name | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole key JSON on one line (or, locally, a path to the `.json` file) |
| `GOOGLE_DRIVE_FOLDER_ID` | the shared folder id |
| `GOOGLE_CONTENT_INDEX_SHEET_ID` | optional Content Index sheet id |
| `GOOGLE_SCHEDULE_SHEET_ID` | optional; reserved for live Sheet → classes sync later |

7. `npm run sync:google -- --dry-run`, then `npm run sync:google`, then redeploy. Admin → **Content** lists every synced page with a link back to its Doc.

Only the sync job talks to Google — no OAuth for individual staff, nothing Google-related runs in the browser. Code lives in `src/lib/google/` (service-account JWT, Drive REST client, Docs HTML cleanup, `ContentPage` upsert) and `scripts/sync-google.ts`; no Google SDK dependency.

### Notion (deprecated)

Notion is no longer the CMS. `npm run sync:notion` and the `NOTION_*` env vars still exist so old setups don't break, but no new content should go into Notion — use the Drive folder above. `ContentPage.notionId` is kept for fixture compatibility.

## Zeffy (tickets, memberships, calendar links)

Zeffy stays the checkout; this portal mirrors payments onto class bookings and memberships.

**When you get Zeffy access:**

1. Zeffy → **Settings → Integrations** → create an **API key** and optionally a **webhook**
2. Webhook URL: `https://YOUR_DOMAIN/api/zeffy/webhook` (subscribe to `payment.completed`)
3. Set on Cloudflare (Variables and Secrets) or `.env.local` (never commit the values):
   - `ZEFFY_API_KEY`
   - `ZEFFY_WEBHOOK_SECRET` (signing secret from the webhook settings)
   - optional `ZEFFY_API_BASE` (default `https://api.zeffy.com/api/v1`)
4. Memberships: publish the membership campaign in Zeffy with at least one rate. `/join` reads `GET /api/memberships` when the key is set, and falls back to fixture products when it is not.
5. Classes: Admin → Classes → paste each event’s **Zeffy campaign ID**
6. Run `npm run sync:zeffy` to pull public Register URLs onto classes and upsert membership products. `npm run sync:zeffy -- --dry-run` prints the mapping without writing.

The API is **read-only**. This app never creates charges or talks to payouts.

Membership programs in Zeffy are ticketing campaigns with category `MembershipV2`. Rates on `GET /campaigns/:id` are the membership types. The Contacts API has no “is a member” flag — roster sync uses succeeded payments on those campaigns.

Without `ZEFFY_API_KEY`, `npm run sync:zeffy` prints setup help and exits 0 (safe for CI).

```bash
npm run sync:zeffy
npm run sync:zeffy -- --dry-run
```

## Tests

```bash
npm run lint       # ESLint. Errors and warnings both fail
npm run typecheck  # next typegen, then tsc
npm test           # Vitest: access rules, data API policy, route handlers
npm run db:check   # every migrations/*.sql applies to an empty database
npm run test:e2e   # Playwright against `next dev` on fixtures
npm run e2e:db     # rebuild the local database the kiosk browser tests use
```

`.github/workflows/ci.yml` runs all of these, plus a production build, on every pull request and on pushes to `main`. Cloudflare deploys `main` on its own, so require the `check` and `e2e` jobs in the branch protection rule for `main` to keep a failing build off the live site. A third job, `audit`, fails when a production dependency has a high-severity advisory; it runs on its own so that an advisory does not also switch off the browser tests. When the `db-artifacts` workflow adds a migration commit to a branch, GitHub does not start CI for that commit. Push again or re-run the jobs.

The kiosk tests (`e2e/workstation.spec.ts`) need a real database, because the kiosk APIs read it directly instead of fixtures. `npm run e2e:db` builds one: it deletes the local D1 that `next dev` uses (`.wrangler/state/v3/d1`), applies `migrations/*.sql` with `wrangler d1 migrations apply --local`, then adds the desk `BOX-PC-1`, three members whose demo PIN is stored as a hash, and one staff account. Stop `next dev` before you run it. It only touches the local database, never the live one.

CI runs `npm run e2e:db` before the browser tests and sets `E2E_WORKSTATION=1`, which makes a missing database a failure. On your machine the kiosk tests run when that database is there and skip with a note when it is not. `E2E_WORKSTATION=0` skips them outright. Each run leaves one wrong PIN on the second member, and 20 in a day lock that email, so after many runs the wrong-PIN test fails with a 429 until you run `npm run e2e:db` again.

`e2e/live-auth.spec.ts` is skipped unless you set `E2E_LIVE=1` (needs a seeded session cookie). If Playwright cannot download its browser, point `PLAYWRIGHT_CHROMIUM_PATH` at a local Chromium.

## Docker Compose

```bash
docker compose up mailpit
# optional: docker compose --profile postgres up db
```

For Postgres production, change `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL` accordingly (no engine-specific features are used).

## Data layer

| Piece | Location |
|---|---|
| Types | `src/lib/data/types.ts` |
| Interface | `src/lib/data/provider.ts` |
| Mock | `src/lib/data/mock-provider.ts` |
| Prisma | `src/lib/data/prisma-provider.ts` |
| Factory | `src/lib/data/factory.ts` |
| Fixtures | `data/mock/*.json` |
| Google Drive CMS | `src/lib/google/*`, `scripts/sync-google.ts` |

## Routes (summary)

Public: `/join`, `/support`, `/policies`, `/volunteer`, `/login`, `/equipment`, `/display?token=…`, `/bounties`, `/history`, `/staff`  
Member: `/dashboard`, `/account`, `/certifications`, `/usage`, `/classes`, `/reserve`, `/learn`, `/inventory`, `/bounties` (claim), onboarding  
Admin: `/admin/*` (including `/admin/display`), `/dev/reader`  
Inventory: `/inventory`, `/inventory/new`, `/inventory/review`, `/inventory/[assetTag]`, `/inventory/labels`, `/inventory/import`, short QR `/i/BX-00042`  

## Learning modules

Curated course material lives in two source files under `data/mock/`:

- `learning-videos.json` — modules, lessons, YouTube embeds (Alpine Trails Studio for woodshop; machine-specific elsewhere)
- `learning-questions.json` — quiz banks with `safetyCritical` and shop-policy placeholders

Twelve modules include Shop Orientation through CNC Plasma, plus **Resin** (in-house safety lesson, no gate video), **Embroidery**, and **Sublimation** (best-practice assumptions until models are confirmed on the floor).

Expand into fixture tables with:

```bash
npm run fixtures:learning
# After editing source JSON for resin/embroidery/sublimation helpers:
npm run fixtures:learning:extend
```

**Rules encoded in the portal:**

- Quiz pass → `knowledge_passed` only; machine access still needs a staff checkoff (except knowledge-only Shop Orientation).
- Pass requires the score threshold **and** every `safetyCritical` question correct when `requireSafetyCriticalAll` is on (default).
- Publish is blocked while any question has `answerPending`, any primary video is unreviewed, equipment is unconfirmed, or a lesson is marked `gap`.
- Machines with `attendedOperationRequired` cannot be reserved past closing; lobby/reserve show an attend-while-running badge.
- Resin is a separate certification from FDM.

Staff review readiness under **Admin → Learn**. Members only see published modules on `/learn`.

## Machine access API (ESP32 readers)

Badge readers call these routes with `X-Reader-Secret` (or `Authorization: Bearer …`) matching `READER_SHARED_SECRET`:

| Method | Path | Body |
|---|---|---|
| `POST` | `/api/access/authorize` | `{ "readerKey", "badgeUid" }` |
| `POST` | `/api/access/end` | `{ "readerKey", "sessionId" }` |
| `GET` | `/api/access/allowlist?readerKey=…` | — |

Firmware for **ESP32 + PN532 + Shelly Smart Plug** lives in [`firmware/esp32-reader`](firmware/esp32-reader). See that README for wiring and flash steps.

## Lobby display (kiosk TV)

Full-screen `/display?token=…` for a stick PC or Raspberry Pi in Chromium kiosk mode. Protected by the `DISPLAY_TOKEN` Worker secret. Staff copy the full kiosk URL from **Admin → Display**, which builds it server-side so the token never ships in client JavaScript. Polls `/api/display/feed` every 60s.

```bash
# Example Chromium kiosk (Linux)
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  "http://localhost:3000/display?token=$DISPLAY_TOKEN"
```

Disable screen sleep on the device (e.g. `xset s off`, `xset -dpms`, or Raspberry Pi OS screen blanking settings). Use a systemd user service or desktop autostart that opens the URL after network is up.

Every slide has a photo on the left and its content on the right. Staff run the whole thing from **Admin → Display**, and changes reach the TV within a minute, with no deploy:

- **Photos.** Add photos from a phone or laptop. They are shrunk in the browser (1600 px long edge) and the display rotates through them, one per slide. Each can have a caption, be hidden, reordered or deleted. Up to 60. Until there is one, the photo side shows a brand-coloured panel. The photo area is taller than wide, so wide photos are cropped at the sides.
- **Promo slides.** Title, text, optional picture and QR link, with start and end dates. A promo's own picture replaces the rotating photo on that slide.
- **Panels.** Order, pinned panel, seconds per slide, name display, how often Membership appears. Lists longer than a screen (machines, classes, membership tiers) show a screen at a time, moving on each rotation.
- **Event spotlight** and **Community events.** The spotlight gives one event a slide to itself, with its description, and moves to the next event each rotation (the next three weeks, each event once). Community events lists the free open events for the next five weeks. Descriptions come from each event's Zeffy page: the scheduled Zeffy pull keeps them as class pages (`class-zeffy-<campaign id>`), and a description written in Admin → Classes takes priority.
- **Motion.** *Full* zooms photos slowly and shows a progress bar. *Calm* keeps only the fades: use it if the kiosk stutters (a Raspberry Pi 3 may).

Promos, settings and photo rows are stored in D1 (`PromoSlide`, `DisplayConfig`, `DisplayPhoto`). Pictures are stored as base64 text in `DisplayPhotoBlob`, because the Worker has no disk or object storage and D1 holds one value of up to 2 MB; uploads are capped at 1.4 MB (`src/lib/display/limits.ts`). `src/lib/display/photo-store.ts` is the only code that touches the bytes, so moving them to R2 later changes one file. In local dev the pictures go to `.data/display-photos/` and the sample promos and photos in `data/mock/` are shown; the live site never shows those.

## Env

See `.env.example` for every variable (`DATA_PROVIDER`, `DATABASE_URL`, Auth, Google Drive CMS, Zeffy, payment URLs).

## Build order

1. Phase 1 — shell + mock + public pages  
2. Phase 2 — onboarding, dashboard, account, certifications, usage  
3. Phase 3 — classes, reserve, learn/quizzes  
4. Phase 4 — admin + `/dev/reader`  
5. **Phase 5 — Prisma, Auth, Google Drive CMS sync, Docker, tests** ← you are here  
6. Machine access API + polish  

Stop for review after each phase.
