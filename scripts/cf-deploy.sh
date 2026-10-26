#!/usr/bin/env bash
# Cloudflare Workers Builds "deploy command".
# 1. Apply any new migrations/*.sql to the production D1 database.
# 2. If the build variable SEED_D1 is set, load prisma/seed-data.sql
#    (INSERT OR IGNORE, so re-running never duplicates or overwrites rows).
# 3. Deploy the OpenNext bundle built by the build command.
set -euo pipefail

npx wrangler d1 migrations apply thebox-db --remote

if [ -n "${SEED_D1:-}" ]; then
  echo "SEED_D1 is set: loading prisma/seed-data.sql into thebox-db"
  npx wrangler d1 execute thebox-db --remote --yes --file=prisma/seed-data.sql
fi

npx opennextjs-cloudflare deploy
