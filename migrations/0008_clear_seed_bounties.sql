-- Demo bounties from data/mock/bounties.json. Real requests use other ids.
DELETE FROM "Bounty" WHERE "id" IN (
  'bounty-open-sign',
  'bounty-open-hooks',
  'bounty-claimed-aprons',
  'bounty-done-keychains'
);
