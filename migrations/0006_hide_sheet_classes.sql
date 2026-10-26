-- The winter sheet import was stored as ordinary classes. Mark it so the public
-- page can show Zeffy events instead. Portal-created classes are unaffected.
UPDATE "ClassSession" SET "source" = 'csv' WHERE "id" LIKE 'class-w26-%';
