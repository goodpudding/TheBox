-- The waiver named "The Box". Its wording is what members signed, so the
-- rename is published as a new version, 2026.2, and members are asked to
-- sign it. Only the 2026.1 waiver is changed: one that staff have already
-- replaced is left as it is.
UPDATE "ContentPage"
SET "html" = REPLACE(REPLACE(REPLACE(REPLACE("html",
      'The Box makerspace', 'Discover Burien Makerspace'),
      'The Box staff', 'Discover Burien Makerspace staff'),
      'The Box', 'Discover Burien Makerspace'),
      '(version 2026.1)', '(version 2026.2)'),
    "version" = '2026.2',
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "category" = 'waiver'
  AND "version" = '2026.1'
  AND instr("html", 'The Box') > 0;

-- Make 2026.2 the version members must have signed, but only when the
-- statement above actually published it.
UPDATE "OrgSettings"
SET "currentWaiverVersion" = '2026.2'
WHERE "currentWaiverVersion" = '2026.1'
  AND EXISTS (
    SELECT 1 FROM "ContentPage"
    WHERE "category" = 'waiver' AND "version" = '2026.2'
  );
