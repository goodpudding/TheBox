# Lobby display: photo-led look, uploaded photos, saved promos

Date: 2026-11-21. Status: awaiting approval.

## Why

The lobby TV now runs `/display` from a Raspberry Pi 3 B+ on an old 1080p
Sony Bravia that faces the street. It works, but the owner finds it "very
black and white, very boring, not very eye-catching" and wants colour, photos
like the ones the makerspace posts on social media, and more life. Of three
mockups they picked the photo-led one ("C"): a large photo on the left, the
slide's content on a warm cream panel on the right.

## Goals

1. Every slide uses the photo-led look, with the brand's colours.
2. Staff can add and remove the photos themselves, from a phone or laptop,
   with no developer and no deploy.
3. Promo slides and display settings edited in Admin → Display are kept on the
   live site. Today they are read from fixture files and writes are refused.
4. Gentle motion, light enough for a Raspberry Pi 3.

## Non-goals

- Pulling posts from Instagram or Facebook automatically. Meta only allows it
  through a developer app and renewable tokens; the owner was told this is
  fragile and uploads were proposed instead.
- Video, sound, weather, or any new kind of data on the slides.
- Changing what each panel reports (classes, machines, certs, bounties,
  membership) or the kiosk URL and token.
- A general media library for the rest of the site.

## Anti-goals

- Sample or placeholder content on the lobby TV. The fixture promos include
  "Holiday open house — Future-dated promo — not shown until December", which
  would start showing on the live TV on 1 December. The six images in
  `public/images/projects/` are placeholders too and must not be shown as
  members' work.
- A screen that looks broken when there are no photos, or when one fails to
  load.
- Animation that stutters on the Pi.

## Constraints

- Raspberry Pi 3 B+, 1 GB, Chromium kiosk, 1920×1080. Animate only
  `transform` and `opacity`. No blur filters, no video, no large shadows that
  repaint. One photo decoded at a time plus the next one preloaded.
- Read from across a room or through a window: no text smaller than about
  1.3vw, strong contrast, QR codes at least as large as today.
- The live site is a Cloudflare Worker with a D1 database and no object
  storage. Nothing may write to local disk in production.
- D1 limits a single value to 2 MB.
- The provider loads the whole database into a bundle for each request
  (`src/lib/data/prisma-provider.ts`). Photo bytes must stay out of it.
- Schema changes go in `prisma/schema.prisma`; the `db-artifacts` workflow
  writes the migration when the branch is pushed.
- This Next.js has breaking changes; read `node_modules/next/dist/docs/`
  before writing route or page code (AGENTS.md).

## Approaches considered

Look. Three mockups were shown: A "poster" (banner yellow, navy, gears), B
"night" (dark navy), C "photo". The owner chose C.

Where photos come from:

1. Upload in Admin → Display, stored in D1 (chosen). No account setup for the
   owner, works from a phone, appears on the TV within a minute. Cost: D1 is
   not built for files, so photos are resized in the browser first and kept
   well under the 2 MB limit.
2. Cloudflare R2 bucket. The proper home for files, but the owner would have
   to enable R2 and add a binding, and the gain at a few dozen photos is nil.
   The storage sits behind two functions so it can move later.
3. A Google Drive folder read by the Worker. Nice from a phone, but needs the
   Google service account set up on the live site, which it does not appear
   to have.
4. Automatic Instagram pull. Ruled out above.

The owner has not confirmed option 1 in words; it is the builder's call and is
presented to them for correction.

## Design

### The look (all slides)

The approved mockup of the "Coming up" slide is
`assets/2026-11-21-display-look-c.jpg` (1920×1080). The photo in it is a
placeholder. The other slides follow its layout, type sizes and colours.

- Left 44% of the screen: the photo, cover-fit and centred (a landscape photo
  is cropped at the sides; that is accepted), with a dark gradient at the
  bottom carrying an optional caption under a small "Made at The Box" label.
  The photo zooms slowly (scale 1.00 → 1.06) over the life of the slide.
- Right 56%: cream panel (`#FFF6E3`), brown text (`#3A2408`), accents coral
  (`#E37263`), teal (`#3E9CC4`), gold (`#CF9426`), green for "Open now".
  Outfit throughout.
- Header on the right panel: "Discover Burien Makerspace / The Box", an
  "Open now" or "Closed" pill, and the date and today's hours beneath it.
- A thin progress bar along the bottom of the right panel fills over the
  slide's duration.
- Slide change: the content fades and rises in; the photo cross-fades. The
  photo advances by one each time the slide changes.
- No photos, or a photo fails to load: the left side is a solid brand panel
  (coral with large gear outlines and "Imagine. Design. Create."). Never a
  broken image, never sample art.
- The "Updated N min ago" note stays, under the pill.

Per slide, on the right panel:

- Coming up: the next class as a coral feature card (label with day, date and
  time; title; spots left; QR). Up to three more as rows with a coloured bar,
  title, "day date · time · spots left", and QR. The street address is
  dropped from rows: the TV is at that address.
- Today: today's classes as rows with time and spots; machine reservations
  beneath as compact chips. Either list may be empty.
- Machines: a grid of status cards. Available is green-tinted, in use coral,
  reserved gold, maintenance grey. Keep "Attend while running".
- Get certified: checkoff sessions as rows; online certifications as chips.
- Bounty board: rows with title, business name, and an "Open" or "Claimed by"
  tag.
- Promos: title, body, QR. If the promo has its own image it takes the photo
  side for that slide instead of the rotating photo.
- Membership: tiers as rows with the price in coral, one join QR.

Which panels rotate, their order, and the timing still come from the display
settings.

### Photos

- New `DisplayPhoto` rows: id, caption (optional), active, sort order, mime
  type, width, height, created/updated, soft delete. The image bytes live in
  a separate `DisplayPhotoBlob` table keyed by photo id, so the per-request
  bundle never carries them.
- Admin → Display gains a "Photos" section: choose one or more files, each is
  resized in the browser to a 1600 px long edge as JPEG (reuse the approach in
  `src/lib/inventory/compress-client.ts`), then uploaded. Staff can edit the
  caption, hide or show a photo, reorder, and delete. Thumbnails are shown.
- Limits: staff only; JPEG, PNG or WebP in; stored as JPEG; reject anything
  over 1.5 MB after resizing; at most 60 photos.
- Serving: `GET /api/display/photos/[id]` returns the bytes with a long cache
  lifetime. Ids are unguessable; no token needed, since these are pictures the
  makerspace chose to show to the street.
- The display feed gains `photos: { id, url, caption }[]`, active ones in
  order.
- Promo images use the same upload, replacing the dev-only disk upload in
  `src/app/api/display/upload/route.ts`.

### Promos and settings on the live site

- `PromoSlide` and `DisplayConfig` tables already exist. Load them from D1 in
  the Prisma provider instead of fixtures, persist changes the way other
  tables are persisted, and take `savePromo`, `deletePromo` and
  `saveDisplayConfig` off the not-stored list.
- The live site starts with no promos. Nobody can have made a real one, because
  the live site has refused promo writes until now, so a migration deletes
  every `PromoSlide` row, and promos are taken out of the seed data. An
  existing `DisplayConfig` row is kept; if there is none, the defaults apply.
  Fixture promos remain for local dev and tests only.
- Remove the "not saved on the live site yet" notice from Admin → Display.

### Motion on the Pi

Whether the Pi's Chromium draws with the GPU is unknown, and nobody can test
on the device before deploy. So motion gets a switch: display settings gain
`motion` (`full` or `calm`, default `full`), editable in Admin → Display.
`calm` keeps the fade between slides and drops the continuous photo zoom and
the moving progress bar. After deploy the owner watches the TV and switches to
`calm` if it stutters.

## Left to the builder

- Exact sizes, spacing and easing, guided by the approved mockup.
- Component structure, and whether photo metadata flows through the bundle or
  through direct queries.
- How to encode bytes for D1 through Prisma.
- Test split: unit tests for feed and limits, e2e for the display rendering
  with and without photos.

## Done when

- `/display` shows every panel in the new look with fixture data, with photos
  and with none, and passes the existing display tests (updated where the
  markup changed).
- A staff user can upload, caption, hide and delete a photo, and it appears on
  the display.
- On a production-mode build, a promo saved in Admin → Display is still there
  after a reload, and no fixture promo appears in the feed.
- Lint, typecheck, unit tests and e2e pass.
