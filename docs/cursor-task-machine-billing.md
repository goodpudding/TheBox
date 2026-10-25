# Cursor task: implement docs/machine-billing-spec.md

Read `docs/machine-billing-spec.md` fully, then `AGENTS.md` (and `node_modules/next/dist/docs/` for Next 16 APIs) before writing code.
Work in the order of spec §10. Open one branch per step: `feature/jobs-1-schema`, `feature/jobs-2-3mf`, …
Rules:
- Reuse `evaluateMachineAccess` (src/lib/data/access.ts) — add a job mode, do not fork the logic.
- Reuse `readerSecretIsValid` (src/lib/access-api.ts) for bridge auth.
- Follow the existing `DataProvider` pattern: add job/rate/credit methods to `provider.ts`, implement in both `mock-provider.ts` and `prisma-provider.ts`, and add mock JSON under `data/mock/` so `next dev` works without the DB.
- Money totals are integer cents; only the per-unit rate may be fractional (see pricing.ts). Never float dollars.
- Printer access codes are never serialized to the client. Grep for it in a test.
- `src/lib/jobs/pricing.ts` and its test already exist — build on them; keep them passing (`npx vitest run src/lib/jobs`).
- Every API route validates input with zod, returns `{ error }` with 400/401/403/404 like the access routes.
- Do not delete or rename existing badge/Badger code; it stays as a fallback.
Definition of done for step 3: a `maker` user with the FDM cert can upload a sliced 3MF, see $10.42 for 668 g, confirm, and see the job as `released` in `/admin/jobs`; a user missing the cert sees "Get certified" and cannot confirm; a `friend` user gets `no_shop_access`.
