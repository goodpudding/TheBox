# The Box Portal

Member-facing web app and back office for **The Box**, the community makerspace run by Discover Burien (Burien, WA).

## Status

**Phase 5 (current):** Prisma schema + seed, PrismaDataProvider, Auth.js magic links, Notion sync script, Docker Compose (Mailpit), Vitest, Playwright smoke tests. UI still defaults to **mock** data for day-to-day work.

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

## Notion CMS sync

```bash
npm run sync:notion
```

Without `NOTION_TOKEN`, the script prints setup help and exits. With token + page IDs, it pulls waiver/hours (and notes policy/volunteer DB IDs) into `ContentPage`.

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

## Routes (summary)

Public: `/join`, `/support`, `/policies`, `/volunteer`, `/login`, `/equipment`, `/display?token=…`  
Member: `/dashboard`, `/account`, `/certifications`, `/usage`, `/classes`, `/reserve`, `/learn`, onboarding  
Admin: `/admin/*` (including `/admin/display`), `/dev/reader`  

## Lobby display (kiosk TV)

Full-screen `/display?token=…` for a stick PC or Raspberry Pi in Chromium kiosk mode. Protected by `DISPLAY_TOKEN` (must match `NEXT_PUBLIC_DISPLAY_TOKEN`). Polls `/api/display/feed` every 60s.

```bash
# Example Chromium kiosk (Linux)
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  "http://localhost:3000/display?token=$DISPLAY_TOKEN"
```

Disable screen sleep on the device (e.g. `xset s off`, `xset -dpms`, or Raspberry Pi OS screen blanking settings). Use a systemd user service or desktop autostart that opens the URL after network is up.

Staff edit promos, panel order, cadence, and name display under **Admin → Display**. Promo images upload to `public/uploads/promos` in development; for production, point uploads at object storage (S3/R2) and store the resulting URL on the promo.

## Env

See `.env.example` for every variable (`DATA_PROVIDER`, `DATABASE_URL`, Auth, Notion, payment URLs).

## Build order

1. Phase 1 — shell + mock + public pages  
2. Phase 2 — onboarding, dashboard, account, certifications, usage  
3. Phase 3 — classes, reserve, learn/quizzes  
4. Phase 4 — admin + `/dev/reader`  
5. **Phase 5 — Prisma, Auth, Notion sync, Docker, tests** ← you are here  
6. Machine access API + polish  

Stop for review after each phase.
