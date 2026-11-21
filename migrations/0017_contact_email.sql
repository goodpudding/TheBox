-- The makerspace's contact address, shown on the Staff, Support, Wishlist and
-- class-idea pages. An address staff set themselves is kept.
UPDATE "OrgSettings"
SET "contactEmail" = 'discovermakers@gmail.com'
WHERE "contactEmail" = 'thebox@discoverburien.org';
