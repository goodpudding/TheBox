# The Box Portal

Member-facing web app and back office for **The Box**, the community makerspace run by Discover Burien (Burien, WA).

## Status

**Phase 5 (current):** Prisma schema + seed, PrismaDataProvider, Auth.js magic links, Google Drive CMS sync scaffold, Docker Compose (Mailpit), Vitest, Playwright smoke tests. UI still defaults to **mock** data for day-to-day work.

**Phase 4:** staff admin + `/dev/reader`  
**Phase 3:** classes, reserve, learn/quizzes  
**Phase 2:** onboarding, dashboard, account, certifications, usage  
**Phase 1:** shell, fixtures, public pages  

## Demo preview (shareable, not “live”)

Host a **demo** on Vercel with mock data — useful for showing staff/board without launching the real site.

1. Create a free [Vercel](https://vercel.com) account (GitHub login is fine).
2. From this folder:

```bash
npx vercel login
npx vercel --yes
```

3. In the Vercel project → **Settings → Environment Variables**, set:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `AUTH_SECRET` | any long random string |
| `AUTH_URL` | your `*.vercel.app` URL |
| `NEXT_PUBLIC_SITE_URL` | same URL |
| `DATA_PROVIDER` | `mock` |

4. Redeploy: `npx vercel --prod --yes` (or push if the project is linked to git).

You’ll get a URL like `https://the-box-portal-….vercel.app`. It’s public to anyone with the link, but clearly marked **Demo**, not indexed for search, and not on a Discover Burien domain. Optional: turn on Vercel **Deployment Protection** (password) if you want the link locked.

Local quick share while your laptop is on (temporary):

```bash
npx cloudflared tunnel --url http://localhost:3000
```

## Local development (mock UI — default)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Dev · Switch user** at the bottom.

## Prisma (SQLite)

```bash
cp .env.example .env   # set AUTH_SECRET, DATABASE_URL=file:./dev.db
npm run db:push
npm run db:seed
```

- Schema: `prisma/schema.prisma` (mirrors fixtures; SQLite in dev)
- Seed: `npm run db:seed` loads `data/mock/*.json`
- Provider: `createPrismaDataProvider()` when `DATA_PROVIDER=prisma` (see `src/lib/data/factory.ts`)

The interactive UI continues to use `MockDataProvider` in the browser. Prisma is ready for server routes, Auth, seed, and sync. Switching the client over to a server RPC bridge is a follow-up polish step before Phase 6 access API goes live.

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

Without `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_DRIVE_FOLDER_ID`, the script prints the setup steps and exits 0 (safe for CI and Vercel builds). Nothing in the app blocks on Google being configured — mock content in `data/mock/content` keeps working.

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
6. Set env (local `.env`, and Vercel → Settings → Environment Variables):

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

## Zeffy (automatic tickets + calendar links)

Zeffy stays the checkout; this portal mirrors payments onto class bookings.

**When you get Zeffy access:**

1. Zeffy → **Settings → Integrations** → create an **API key** and a **webhook**
2. Webhook URL: `https://YOUR_DOMAIN/api/zeffy/webhook` (subscribe to `payment.completed`)
3. Set on Vercel / `.env`:
   - `ZEFFY_API_KEY`
   - `ZEFFY_WEBHOOK_SECRET` (signing secret from the webhook settings)
4. Admin → Classes → paste each event’s **Zeffy campaign ID**
5. Run `npm run sync:zeffy` to pull public Register URLs onto those classes

Payments then mark the matching member booking paid (email + campaign ID). Guests who pay but have no portal account are logged as unmatched — they still keep their Zeffy ticket.

```bash
npm run sync:zeffy
```

Without `ZEFFY_API_KEY`, the script prints setup help and exits 0 (safe for CI).

## Tests

```bash
npm test           # Vitest — machine access rules
npm run test:e2e   # Playwright smoke (starts dev server)
```

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

Public: `/join`, `/support`, `/policies`, `/volunteer`, `/login`, `/equipment`, `/display?token=…`, `/bounties`  
Member: `/dashboard`, `/account`, `/certifications`, `/usage`, `/classes`, `/reserve`, `/learn`, `/bounties` (claim), onboarding  
Admin: `/admin/*` (including `/admin/display`), `/dev/reader`  

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

Full-screen `/display?token=…` for a stick PC or Raspberry Pi in Chromium kiosk mode. Protected by `DISPLAY_TOKEN` (must match `NEXT_PUBLIC_DISPLAY_TOKEN`). Polls `/api/display/feed` every 60s.

```bash
# Example Chromium kiosk (Linux)
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  "http://localhost:3000/display?token=$DISPLAY_TOKEN"
```

Disable screen sleep on the device (e.g. `xset s off`, `xset -dpms`, or Raspberry Pi OS screen blanking settings). Use a systemd user service or desktop autostart that opens the URL after network is up.

Staff edit promos, panel order, cadence, and name display under **Admin → Display**. Promo images upload to `public/uploads/promos` in development, and `npm run sync:google` drops images from Drive `Photos/Promos/` into the same folder; for production, point uploads at object storage (S3/R2) and store the resulting URL on the promo.

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
