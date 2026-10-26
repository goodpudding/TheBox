-- Run once after the ClassSession.source migration is applied:
--   npx wrangler d1 execute thebox-db --remote --file=scripts/one-off/mark-csv-class-sessions.sql
-- Existing sheet-imported rows have no Zeffy campaign id. New portal classes default to source='admin'.
UPDATE "ClassSession" SET "source" = 'csv' WHERE "zeffyCampaignId" IS NULL;
