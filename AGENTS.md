<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Machine billing / print gating (Oct 2026)

The badge+ESP32 flow is being replaced by app-based job submission and estimate billing.
Before touching anything under `src/lib/jobs/`, `src/app/jobs/`, `src/app/api/jobs/`, or `bridge/`,
read `docs/machine-billing-spec.md`, then follow `docs/cursor-task-machine-billing.md` step by step.
Pricing is `src/lib/jobs/pricing.ts` (tested); rates and tiers live in the spec §4 and are seeded, not hard-coded.
