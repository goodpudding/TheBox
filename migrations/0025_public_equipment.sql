-- Inventory items are listed on the public Equipment page once approved. Staff or
-- the area's steward can switch one off. Every item that is already there starts
-- shown. The column goes last: prisma/seed-data.sql gives values by position.
--
-- Written by hand as ADD COLUMN. Prisma's generated version rebuilds the table
-- (create new, copy, drop old), and on D1 dropping InventoryItem would take its
-- photos and history with it, because foreign keys cannot be switched off there.
ALTER TABLE "InventoryItem" ADD COLUMN "showPublicly" BOOLEAN NOT NULL DEFAULT true;
