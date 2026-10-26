-- Seeded checkout was a placeholder form that Zeffy does not host.
UPDATE "OrgSettings"
SET "paymentUrl" = 'https://www.zeffy.com/en-US/ticketing/burien-makers-spaces-memberships'
WHERE "paymentUrl" LIKE '%example-the-box';

-- First portal admin. Later role changes belong in the admin member page.
UPDATE "User"
SET "role" = 'admin', "status" = 'active'
WHERE lower("email") = 'james.trey.young@gmail.com';
