# Workstation PIN: let members set and staff reset it

Brief for Cursor. Follow-on to `docs/live-data-bridge-spec.md` and `docs/role-management-spec.md`; separate branch and PR. Verify in `next dev` with the mock provider and the `/workstation?device=BOX-PC-1` page.

## Why

The workstation sign-in (`src/app/workstation/workstation-client.tsx`) already has two tabs: **PIN** (email + PIN, default) and **QR** (phone). The PIN path is for members who don't want to use a phone. `POST /api/workstation/login` verifies against `User.kioskPinHash` (scrypt, `src/lib/workstation/pin.ts`). But nothing lets a real member obtain a PIN: the only writer is `seedDemoPinIfMissing()` for fixtures. So the PIN tab works for the 19 seeded users and nobody else.

## 1. Member sets their own PIN (account page)

`src/app/account/page.tsx`, new section after "Profile" and before "Linked badges" (drop "Linked badges" from this page while you're there — badges are retired; keep the data model).

- Section title "Shop PIN". Copy: *"Use this with the email on your membership to sign in at any shop PC. 4–6 digits."*
- Two inputs: PIN and confirm. `inputMode="numeric"`, `pattern="\d{4,6}"`, `autoComplete="off"`, masked.
- If the member already has a PIN, show "PIN is set · Change PIN"; changing requires the new PIN twice, nothing else (the magic-link session is the authentication).
- Provider method `setMyKioskPin(userId, pin)` on `DataProvider`, implemented in mock and Prisma providers. Prisma: `kioskPinHash = await hashKioskPin(pin)`, clear any `kioskPinMustChange` flag (see §2). Reject PINs that aren't 4–6 digits, and reject the trivial ones `0000`, `1234`, `1111`, `123456`.
- Never return or display the PIN or hash after saving. Success message: "Shop PIN saved."

## 2. Staff reset (admin member page)

`src/app/admin/members/[id]/page.tsx`, next to the Status/Role controls. Visible to `staff` and `admin`.

- Button **Reset shop PIN**. Confirmation dialog. On confirm, the provider generates a random 6-digit temporary PIN, stores its hash, sets a new `User.kioskPinMustChange Boolean @default(false)` to `true`, writes an `AuditEvent` (`action: "member.pin_reset"`, actor, subject, no PIN in metadata), and returns the temporary PIN **once** to the page, which shows it in a dismissable box: *"Temporary PIN: 482 917 — read it to the member; it will not be shown again."*
- Schema change → `prisma/schema.prisma` gets the new boolean; the `db-artifacts` workflow will generate `migrations/0003_*.sql` on push. Don't hand-write the migration.
- When `kioskPinMustChange` is true and the member signs in at a workstation with the temp PIN, the workstation client shows a "Choose a new PIN" step before the normal desk screen (same validation as §1), then clears the flag. Until they do, the temp PIN keeps working so a confused member isn't locked out mid-shift.

## 3. Abuse limits on the workstation login

In `src/lib/workstation/server.ts` login path:

- Track failed PIN attempts per `(workstationId, email)` in memory (a `Map` with timestamps is fine on Workers for this; it only needs to be best-effort). After **5 failures in 10 minutes**, respond `429` with `{ error: "Too many attempts. Try again in a few minutes or ask staff to reset your PIN." }` for that email at that desk for 10 minutes. The client shows the message under the PIN field.
- Unknown email and wrong PIN return the **same** error text ("Email or PIN didn't match") so the screen doesn't reveal which emails are members.
- Log each failure as an `AccessLog` or `AuditEvent` row (`action: "workstation.pin_failed"`, workstationId, email hashed or omitted) so repeated attempts are visible to staff; don't store the attempted PIN.

## 4. Lock screen PIN

The desk lock screen (`lock-pin`, `unlock()` in the client) uses the same PIN. No change needed beyond making sure a PIN changed on the account page takes effect for an already-open session on next unlock (the server verifies against the current hash, so it should already).

## Out of scope

- Emailing PINs (never).
- Showing PINs anywhere after they're set.
- Replacing scrypt or changing `pin.ts`.

## Tests

- Extend `src/lib/workstation/pin.test.ts` or add `pin-policy.test.ts`: rejects non-digit, wrong length, and the trivial-PIN list; accepts `4821`.
- Provider tests: `setMyKioskPin` stores a verifiable hash; staff reset sets `kioskPinMustChange` and writes an audit row; member set clears the flag.
- Login rate limit: 5 failures → 429; a success resets the counter.

## Acceptance

1. As a member in mock mode: set PIN on `/account`, go to `/workstation?device=BOX-PC-1`, PIN tab, sign in with email + PIN. Works.
2. As staff: reset a member's PIN, see the temp PIN once, member signs in with it, is prompted to choose a new one, then the temp PIN stops working.
3. Six wrong PINs in a row → the 6th shows the "too many attempts" message; a different email at the same desk is unaffected.
4. `npm run lint`, `npm test` pass; the schema change produced a new `migrations/0003_*.sql` via the workflow.
