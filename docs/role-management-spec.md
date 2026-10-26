# Role management (staff / admin)

Brief for Cursor. **Do `docs/live-data-bridge-spec.md` first**; this builds on the live provider. Small, self-contained; one branch, one PR. Verify in `next dev` (mock mode) and, if `DATA_PROVIDER=prisma` locally, against the SQLite dev DB.

## Why

`User.role` is `member | staff | admin` and gates `/admin` via `isStaffRole()` (`src/lib/data/access.ts`). There is no UI to change it: the admin member page (`src/app/admin/members/[id]/page.tsx`) can change membership status and the Teacher flag, but not role. Promoting someone currently means SQL in the D1 console. We want staff to approve new staff/admins from the portal, plus a safety net so the first admins can never be locked out.

## 1. Role control on the admin member page

Follow the existing status pattern exactly (`onStatusChange` → `provider.adminUpdateMemberStatus(memberId, next, actorId)`).

- Add `adminUpdateMemberRole(memberId: string, role: UserRole, actorId: string): Promise<User>` to the `DataProvider` interface (`src/lib/data/provider.ts`) and implement it in both `mock-provider.ts` and `prisma-provider.ts`. Export a `UserRole = "member" | "staff" | "admin"` type if one doesn't exist.
- UI: a **Role** `<select>` next to the Status select, same `selectClass`, same pending/error/message handling. Show it **only when the current user is `admin`**; staff see the role as a read-only pill (as today).
- Guards, enforced in the provider (server side), not just hidden in the UI. Throw an `Error` with a human message that the page surfaces in its existing `error` state:
  - Only an `admin` actor may change roles (`staff` may not).
  - An actor may not change their own role (`actorId === memberId`).
  - Demoting an `admin` is refused if they are the **last** active admin (`role = 'admin' AND status = 'active'` count would drop to 0).
  - Value must be one of the three roles.
- Write an `AuditEvent` row (`prisma/schema.prisma` → `AuditEvent`): `action: "member.role_changed"`, `actorId`, `subjectUserId: memberId`, `entityType: "user"`, `entityId: memberId`, `metadata: JSON {"from": old, "to": new}`. The mock provider can push into its in-memory audit list the same way other mock writes do.
- After a successful change, call `bump()` and show `Role set to {role}.` like the status flow.

## 2. `ADMIN_EMAILS` bootstrap (lockout safety net)

- New env var `ADMIN_EMAILS`: comma-separated, case-insensitive. Document it in `.env.example` and README → "Production: Cloudflare Workers + D1" (it's a plain Worker variable, not a secret).
- In `src/auth.ts`, add an Auth.js `events.signIn` (or `callbacks.signIn`) handler: if the signed-in user's email (lowercased) is in `ADMIN_EMAILS` and `user.role !== "admin"`, update the row to `role = "admin"` and write the same `AuditEvent` with `actorId: null` and `metadata: {"from": old, "to": "admin", "via": "ADMIN_EMAILS"}`.
- Never **demote** based on this list; it only promotes. Removing an address from the list does nothing.

## 3. Email normalization

Auth.js matches users by exact `email`. Lowercase and trim the email at the two entry points so `ED@discoverburien.org` and `ed@discoverburien.org` are the same person:
- the login form before calling `signIn("email", …)` (`src/app/login/page.tsx`);
- `normalizeIdentifier` on the email provider in `src/auth.ts` (both the Resend and Nodemailer branches share the config object — set it once).
Do not change existing stored emails in a migration; the seed data is already lowercase.

## 4. Pre-created admins (one-off, not code)

The first two admins will be inserted directly into D1 by Trey/Claude before launch (`role = 'admin'`, `status = 'active'`, lowercase emails). The sign-in flow must therefore treat an **existing** user row with no prior sign-in as a normal login (it already does: Auth.js `getUserByEmail` → existing row). No invitation email is sent by any part of this spec.

## Tests

- `src/lib/data/access.test.ts` style unit tests for the provider guards: staff actor rejected; self-change rejected; last-admin demotion rejected; happy path writes the audit row.
- A Playwright check in `e2e/` is optional; if added, cover "admin sees Role select, staff does not".

## Acceptance

- As an admin in mock mode: open a member, change Member → Staff → Admin → Member; each change persists after reload and an audit row exists.
- As staff: Role select is not rendered; calling the provider method directly throws.
- Trying to demote the only admin shows the error message and leaves the role unchanged.
- With `ADMIN_EMAILS=someone@example.com`, signing in as that address lands you with `role = admin`.
- `ED@Discoverburien.org` typed with capitals on the login page produces one user row with the lowercase email.
- `npm run lint`, `npm test` pass. No schema change is needed (no new migration).
