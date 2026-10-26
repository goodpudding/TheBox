# Live data bridge: make the website use the real session and database

Brief for Cursor. **Do this before the role and PIN briefs** — those add UI on the data layer this replaces. One branch, one PR, but expect it to be the largest change in the repo so far; commit in the steps below so it can be reviewed in pieces.

## The problem

The site is two halves that don't talk:

- **Server half (real):** Auth.js magic links, D1 via Prisma, `/api/workstation/*`, `/api/me`, the Zeffy webhook. `createServerDataProvider()` (`src/lib/data/factory.ts`) returns the Prisma-backed provider when `DATA_PROVIDER=prisma`.
- **Browser half (demo):** `src/components/providers.tsx` hard-codes `createMockDataProvider(null)`. All 64 `useData()` consumers — every member page, the header, every admin page — read and write an in-memory fixture bundle that is thrown away on reload. The "current user" is whatever the Dev toolbar picked. Auth.js is never consulted.

Result in production: a member signs in successfully (Session row exists), then every page still says "Sign in" and shows fixture data.

## The design

Keep the `DataProvider` interface (91 methods, `src/lib/data/provider.ts`) exactly as it is. All argument and return types are already JSON-safe (dates are `ISODate` strings), so the fix is a transport, not a rewrite:

```
browser: RemoteDataProvider ──POST /api/data──▶ server: createServerDataProvider(sessionUser) ──▶ Prisma/D1
```

The mock provider stays for local dev, tests, and the Vercel demo.

## Step 1 — `/api/data` RPC route

`src/app/api/data/route.ts`, `runtime = "nodejs"`, `POST` only, body `{ method: string, args: unknown[] }`.

1. `const session = await auth()`; `userId = session?.user?.id ?? null`.
2. `provider = await createServerDataProvider(userId)`. The provider's `getCurrentUser()` must return the session user (today it returns whatever `initialUserId` points at — that's the same thing; verify).
3. **Method allowlist.** Build it from the `DataProvider` interface keys at module load; reject unknown names with 400. Additionally:
   - `setCurrentUserId`, `listSwitchableUsers`, `getState`: **403 in production** (`process.env.NODE_ENV === "production" && NEXT_PUBLIC_DEMO_MODE !== "true"`). These exist for the Dev toolbar only.
   - `admin*`, `authorizeAccess`, `endAccess`, `getAllowlist`, `savePromo`, `deletePromo`, `saveDisplayConfig`, `applyZeffy*`, `createBookingFromZeffoPayment`: require `isStaffRole(sessionUser)` → else 403. Grep the interface for any other method whose name implies staff and include it; when in doubt, gate it.
   - Everything else requires a signed-in user **except** the public read methods used by logged-out pages: `listClasses`, `getClass`, `listMachines`, `listPolicies`, `getContentBySlug`, `listPeople`, `listVolunteerRoles`, `listBounties`, `getBounty`, `getWishlistCatalog`, `listMembershipProducts`, `getScholarshipFundSummary`, `listInterestBoards`, `getInterestBoard`, `getSettings`, `listModules`, `getModule`. Confirm the list by checking which pages render without a session today.
4. **Actor pinning.** Many methods take an actor/user id argument from the client (e.g. `adminUpdateMemberStatus(memberId, status, actorId)`, `getUsage(userId)`, `book(classId, userId)`). The server must not trust those. Rule: for every method, any argument documented/typed as the *acting* user or *the member's own* id is overwritten with the session user id unless the session user is staff/admin. Implement as a small table `ACTOR_ARG_INDEX: Record<methodName, number>` in the route file; unit-test it against the interface so a new method without an entry fails the test (forces whoever adds a method to decide).
5. Call, return `{ ok: true, result }` or `{ ok: false, error }` with the thrown message; 200 for domain errors (the client rethrows), 4xx for auth/validation.
6. `Cache-Control: no-store`.

## Step 2 — `RemoteDataProvider` (browser)

`src/lib/data/remote-provider.ts`: a `Proxy` whose every property is `async (...args) => rpc(name, args)`; `rpc` does `fetch("/api/data", { method: "POST", credentials: "same-origin", body: JSON.stringify({ method, args }) })`, throws `Error(error)` on `ok: false`, and on 401 dispatches a `window` event `thebox:signed-out` so the UI can refresh its user. Export `createRemoteDataProvider(): DataProvider`.

## Step 3 — Providers choose by mode

`src/components/providers.tsx`:

- `const live = process.env.NEXT_PUBLIC_DATA_MODE === "live"` (set this build variable in Cloudflare → Builds → Variables; leave unset locally so dev stays mock). Fallback: if `NEXT_PUBLIC_DEMO_MODE === "true"` → mock.
- `live` → `createRemoteDataProvider()`; otherwise the mock as today.
- `currentUser` in live mode: subscribe to `useSession()`; when status is `authenticated`, call `provider.getCurrentUser()` and set it; when `unauthenticated`, set `null`. Re-run on the `thebox:signed-out` event. Keep `refreshUser`/`bump` semantics so existing pages don't change.
- `switchUser` in live mode is a no-op that logs a warning.
- `DevToolbar` renders only in mock mode (it already hides in production without demo mode; make the condition `!live` explicitly).

No `useData()` consumer should need to change. If one does (because it relied on synchronous mock state or on `switchUser`), fix it in place and list it in the PR.

## Step 4 — Sign-in / sign-out round trip

- After the magic-link callback lands on `/` (or `callbackUrl`), the header must show the member without a manual reload: `useSession()` handles this; verify `SessionProvider` wraps the tree before `DataProviders` (it does today) and that `refetchOnWindowFocus` is left on.
- `signOut()` in the header must also clear `currentUser` immediately (set null, then `bump()`).
- `/dashboard`, `/account`, `/admin/*` redirect to `/login?callbackUrl=…` when `currentUser` is null **after** session status is resolved, not while it's `loading` (avoid a flash-redirect on every load).

## Step 5 — Performance guardrail (scoped, not a rewrite)

`createPrismaDataProvider()` loads the **entire** database into the mock provider on every call (`loadBundleFromPrisma`, 34 `findMany`s), runs the method, then diffs and persists. Per RPC that is ~35 D1 queries. Fine at launch scale (tens of members, hundreds of rows), not fine at 500 members or on the lobby display polling every 30 s.

Do now, in this PR:
- In `/api/data`, cache the loaded bundle in module scope for **5 seconds** keyed by nothing (single tenant). Reads within the window reuse it; any write method invalidates it after persisting. This collapses the header + page + display polling into one load.
- Log `console.info(JSON.stringify({ rpc: method, ms, queries: "bundle" }))` so the Observability tab shows per-method latency.

Do not do now (write a `// TODO(perf)` and move on): per-method Prisma queries in `prisma-provider.ts`. That's the eventual fix; it's a separate project.

## Step 6 — Config

- README: replace the "The interactive UI continues to use MockDataProvider in the browser" paragraph with the mode table: `NEXT_PUBLIC_DATA_MODE=live` + `DATA_PROVIDER=prisma` in production; nothing set locally = mock.
- `.env.example`: document both.
- Cloudflare (Trey/Claude will set): runtime var `DATA_PROVIDER=prisma`; build var `NEXT_PUBLIC_DATA_MODE=live`.

## Tests

- `src/app/api/data/route.test.ts` (Vitest, mock `auth()` and the provider): unknown method → 400; `admin*` as member → 403; `setCurrentUserId` in production → 403; actor arg is overwritten for a member and preserved for staff; domain error returns `{ ok:false }` with the message.
- `remote-provider.test.ts`: proxies any method name; rethrows errors; emits `thebox:signed-out` on 401.
- Existing suites must still pass with the mock provider (they don't touch `/api/data`).
- Playwright `e2e/live-auth.spec.ts`, skipped unless `E2E_LIVE=1`: sign in via a test magic link is out of scope; instead seed a Session row directly and assert the header shows the member and `/account` renders their profile.

## Acceptance (on the deployed site, `DATA_MODE=live`)

1. Logged out: `/`, `/join`, `/classes`, `/equipment`, `/policies` render with real data from D1 (the seeded machines and products), no fixture-only content.
2. Request a magic link, click it: land on `/`, header shows the member's name without reload; `/account` shows the row from D1; edit profile → reload → persists.
3. Admin (seeded `admin@example.com`, or an account promoted via SQL): `/admin/members` lists D1 users; changing a member's status persists and writes the audit row.
4. Member calling an admin method through the RPC by hand (curl with their cookie) gets 403.
5. Lobby display `/display` still works (its feed route is separate and unchanged).
6. Observability logs show one bundle load per ~5 s under normal browsing, not one per request.
7. Local `next dev` with nothing set behaves exactly as before (mock + Dev toolbar).
