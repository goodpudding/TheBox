# Lobby Display Photo Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every lobby-display slide the photo-led look, let staff upload the photos, and keep promos and display settings on the live site.

**Architecture:** Photo metadata, promos and display settings travel in the provider bundle like every other table, so the mock provider's rules apply in dev and on the live site alike. Photo bytes stay out of the bundle: a small store writes them to their own D1 table (base64 text) on the live site and to local disk in dev, behind two routes. The display reads one feed and renders a shell with a photo side and a content side.

**Tech Stack:** Next.js 16 (App Router, route handlers with promised `params`), React 19, Tailwind 4, Prisma 6 with the D1 adapter, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-lobby-display-photo-look-design.md` (mockup in `assets/`).

## Global Constraints

- Animate only `transform` and `opacity`. No blur filters, no video.
- No display text under about 1.3vw. QR codes no smaller than today.
- Nothing writes to local disk when `getDataProviderMode() === "prisma"`.
- One stored value stays under D1's 2,000,000 bytes: photo bytes are capped at 1,400,000 (base64 of that is 1,866,668). The spec said 1.5 MB; base64 forces the lower cap.
- Photo bytes never enter `MockFixtureBundle`.
- Fixture promos and fixture photos never reach the live feed.
- At most 60 display photos. Captions at most 120 characters.
- Colours: panel `#FFF6E3`, text `#3A2408`, coral `#E37263`, teal `#3E9CC4`, gold `#CF9426`, muted `#645E5E`, rule `#EADFC8`.
- Photo side is the left 44vw; content side the remaining 56vw.

## Review Focus

1. A photo whose bytes are gone (404) or that fails to load: the photo side shows the brand panel, not a broken image. (Task 5, e2e.)
2. An upload that is not an image, or is over the cap: 415 / 413 and nothing stored. (Task 4, route test.)
3. A 61st photo: refused with a message a person can act on. (Task 2, provider test.)
4. No `DisplayConfig` row in D1: defaults are used and the first save creates the row. (Task 3, provider test.)
5. Long titles and full lists: nothing spills past the bottom of the 1080p screen. (Task 5, e2e overflow check on every panel.)

---

### Task 1: Data model

**Files:**
- Modify: `prisma/schema.prisma` (add `DisplayPhoto`, `DisplayPhotoBlob`; `DisplayConfig.motion` as the last column)
- Create: `migrations/0011_display_photos.sql` (from `prisma migrate diff`), `migrations/0012_clear_sample_promos.sql` (`DELETE FROM "PromoSlide";`)
- Modify: `src/lib/data/types.ts`, `src/lib/data/load-fixtures.ts`, `src/lib/data/persist-delta.ts` (`ARRAY_KEYS` gains `promoSlides`, `displayPhotos`)
- Create: `data/mock/display-photos.json` (three dev samples pointing at `public/images/projects/`)
- Modify: `data/mock/display-config.json` (`"motion": "full"`), `prisma/seed.ts` (no promos; seed `motion`), `prisma/seed-data.sql` (drop `PromoSlide` inserts; append `'full'` to the `DisplayConfig` row)

**Interfaces — Produces:**

```ts
export type DisplayMotion = "full" | "calm";
export interface DisplayConfig { /* existing */ motion: DisplayMotion }
export interface DisplayPhoto extends Timestamps {
  id: string;
  caption: string | null;
  active: boolean;
  sortOrder: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  /** Dev fixtures only: a file under /public. Uploaded photos are served by id. */
  staticPath?: string | null;
}
// MockFixtureBundle.displayPhotos: DisplayPhoto[]
```

Schema: `DisplayPhoto(id, caption?, active default true, sortOrder default 0, mimeType, width?, height?, createdAt, updatedAt, deletedAt?)`; `DisplayPhotoBlob(id @id, dataBase64 String, createdAt)`.

- [ ] Write the schema, types and fixtures.
- [ ] Generate `0011` by replaying `migrations/*.sql` into a scratch SQLite file and running `npx prisma migrate diff --from-url file:… --to-schema-datamodel prisma/schema.prisma --script`.
- [ ] Run `npm run db:generate && npm run db:check && npm run typecheck`. Expected: migrations apply, no schema drift, types pass after later tasks fill callers (fix compile errors here by threading the new fields).
- [ ] Commit.

### Task 2: Provider methods and the feed

**Files:**
- Modify: `src/lib/data/provider.ts`, `src/lib/data/mock-provider.ts`, `src/lib/data/rpc-policy.ts`, `src/lib/data/display-feed.ts`
- Test: `src/lib/data/display-feed.test.ts`, `src/lib/data/display-photos.test.ts` (new)

**Interfaces — Produces:**

```ts
export const DISPLAY_PHOTO_LIMIT = 60;
export const DISPLAY_CAPTION_MAX = 120;
export interface DisplayFeedPhoto { id: string; url: string; caption: string | null }
export interface DisplayFeed { /* existing */ photos: DisplayFeedPhoto[] }
export interface DisplayPhotoInput { id: string; caption?: string | null; active?: boolean; sortOrder?: number; mimeType?: string; width?: number | null; height?: number | null }
// DataProvider
listDisplayPhotos(): Promise<DisplayPhoto[]>;          // not deleted, by sortOrder
saveDisplayPhoto(data: DisplayPhotoInput): Promise<DisplayPhoto>;  // create when id unknown
deleteDisplayPhoto(id: string): Promise<void>;         // sets deletedAt, active false
// display-feed.ts
export function displayPhotoUrl(p: Pick<DisplayPhoto, "id" | "staticPath">): string; // staticPath ?? `/api/display/photos/${id}`
```

`saveDisplayPhoto` creating a new photo requires `mimeType`, id matching `/^[0-9a-f-]{36}$/`, and throws `"The display holds 60 photos at most. Delete one first."` at the limit. `saveDisplayConfig` accepts `motion` when it is `"full"` or `"calm"`. RPC rules: all three staff-only, same shape as the promo rules.

- [ ] Tests first: feed lists only active, undeleted photos in `sortOrder`; url uses `staticPath` when set; caption trimmed and cut to 120; 61st create throws; unknown `motion` is ignored; delete hides it from the feed.
- [ ] Run `npx vitest run src/lib/data/display-feed.test.ts src/lib/data/display-photos.test.ts` — fails, then implement, then passes.
- [ ] Commit.

### Task 3: Keep promos, settings and photo rows on the live site

**Files:**
- Modify: `src/lib/data/prisma-provider.ts` (load `promoSlide`, `displayConfig`, `displayPhoto`; save the config singleton; empty the three names from `NOT_STORED_YET`), `src/lib/data/persist-rows.ts` (two table mappings + `displayConfigRow`), `src/lib/data/persist-delta.ts` (`displayConfigChanged`)
- Test: `src/lib/data/prisma-provider.test.ts`, `src/lib/data/persist-delta.test.ts`

Loading: no `DisplayConfig` row → `loadFixtures().displayConfig` values with `motion: "full"`. `panelOrder` is JSON text in the table. Fixture promos and photos are not merged in.

- [ ] Tests first: a promo saved through the persisting provider is written with `promoSlide.upsert`; `saveDisplayConfig` writes `displayConfig.upsert` with id `"default"`; a bundle loaded with no config row has the defaults; the old "refuses display settings, promo slides" test now covers only the wishlist and tool-champion methods.
- [ ] Run `npx vitest run src/lib/data` — fails, implement, passes.
- [ ] Commit.

### Task 4: Photo bytes

**Files:**
- Create: `src/lib/display/photo-store.ts`, `src/lib/display/staff-guard.ts`, `src/app/api/display/photos/route.ts` (POST), `src/app/api/display/photos/[id]/route.ts` (GET, DELETE)
- Delete: `src/app/api/display/upload/route.ts`
- Test: `src/app/api/display/photos/route.test.ts`, `src/lib/display/photo-store.test.ts`

**Interfaces — Produces:**

```ts
export const MAX_DISPLAY_PHOTO_BYTES = 1_400_000;
export function putDisplayPhotoBytes(bytes: Uint8Array, mimeType: PhotoMimeType): Promise<{ id: string }>; // id = randomUUID()
export function getDisplayPhotoBytes(id: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
export function deleteDisplayPhotoBytes(id: string): Promise<void>;
export function staffOnly(): Promise<NextResponse | null>; // null when allowed; dev and demo builds allow everyone
// POST /api/display/photos  (multipart "file") -> 200 { id, mimeType } | 400 | 401 | 403 | 413 | 415
// GET  /api/display/photos/[id] -> bytes, "Cache-Control: public, max-age=31536000, immutable", nosniff, PHOTO_CSP | 404
// DELETE /api/display/photos/[id] -> 204 (staff)
```

Live: rows in `DisplayPhotoBlob`, mime type stored as a `data:` style prefix is not needed — keep `mimeType` by sniffing the decoded bytes with `sniffImageType`. Dev: `.data/display-photos/<id>` on disk. Ids that are not UUIDs return 404 before any lookup.

- [ ] Tests first: text file → 415; 1,400,001 bytes of JPEG header + padding → 413; valid JPEG → 200 and readable back through the store; GET unknown id → 404; GET `../x` → 404.
- [ ] Implement; run `npx vitest run src/app/api/display src/lib/display`.
- [ ] Commit.

### Task 5: The display

**Files:**
- Modify: `src/app/display/display-client.tsx`, `src/components/display/display-shell.tsx`, all seven `panel-*.tsx`, `src/components/display/display-qr.tsx` (dark colour `#3A2408`), `src/app/globals.css` (display keyframes)
- Create: `src/components/display/display-photo.tsx`, `src/components/display/display-parts.tsx` (heading, row, chip, shared date helpers)
- Test: `e2e/display.spec.ts`

**Interfaces:**

```tsx
// display-photo.tsx
export function DisplayPhotoSide(props: { photo: DisplayFeedPhoto | null; overrideSrc?: string | null; motion: DisplayMotion; cadenceMs: number; slideKey: string }): JSX.Element;
// display-shell.tsx
export function DisplayShell(props: { feed: DisplayFeed; staleMinutes?: number | null; photoSide: ReactNode; slideKey: string; cadenceMs: number; children: ReactNode }): JSX.Element;
```

Behaviour: the photo index advances with each slide change; a promo with `imageUrl` passes it as `overrideSrc`. Image `onError`, or no photo, renders the brand panel (`data-testid="display-brand-panel"`). `motion: "calm"` drops the zoom and the progress animation. Root carries `data-testid="display-root"`, the content side `data-testid="display-content"`.

- [ ] e2e first: brand panel when every `/api/display/photos/**` and static photo request is aborted; a photo `<img>` visible with fixtures; for each panel pinned in turn via a mocked feed, `display-content` has `scrollHeight <= clientHeight`; existing tests keep passing.
- [ ] Implement shell, photo side, panels, CSS.
- [ ] Run `npx playwright test e2e/display.spec.ts --trace off`; take 1920×1080 screenshots of every panel and look at them.
- [ ] Commit.

### Task 6: Admin → Display

**Files:**
- Modify: `src/app/admin/display/page.tsx`
- Create: `src/components/admin/display-photos.tsx`, `src/lib/display/compress-client.ts`
- Test: `e2e/display.spec.ts` (admin section)

`compressDisplayPhoto(file: Blob): Promise<{ blob: Blob; width: number; height: number }>` — 1600 px long edge, JPEG 0.8; if over the cap, retry at 1280 px, 0.7. The Photos section: multi-file input, thumbnails, caption field (saved on blur), Show/Hide, Up/Down, Delete. Motion select ("Full" / "Calm") beside the cadence. Promo image upload posts to `/api/display/photos` and stores `/api/display/photos/<id>` in `imageUrl`. Remove the live-site notice and the `disabled={live}` fieldsets.

- [ ] e2e first: as an admin, upload a small JPEG, see its thumbnail and a "Photo added" message, type a caption, delete it.
- [ ] Implement; run the e2e.
- [ ] Commit.

### Task 7: Docs and whole-branch verification

- [ ] README "Lobby display" section: photos, promos saved, motion switch, upload limits.
- [ ] `npm run lint && npm run typecheck && npm run db:check && npm test && npx playwright test --trace off`.
- [ ] Commit, push, open the pull request.
