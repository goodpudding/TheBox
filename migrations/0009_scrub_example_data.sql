-- Example people and the records they own. Real accounts (not @example.com, not u-*) stay.
-- Zeffy classes taught by a real admin stay. Sheet classes (class-w26-*) go.

DELETE FROM "ClassInterestSignup"
WHERE "boardId" LIKE 'interest-%'
   OR "email" LIKE '%@example.com'
   OR "userId" LIKE 'u-%';

DELETE FROM "ClassInterestBoard"
WHERE "id" LIKE 'interest-%'
   OR "contactEmail" LIKE '%@example.com';

DELETE FROM "Booking"
WHERE "classSessionId" LIKE 'class-w26-%'
   OR "userId" LIKE 'u-%'
   OR "paidMarkedById" LIKE 'u-%';

DELETE FROM "ClassSession"
WHERE "id" LIKE 'class-w26-%'
   OR "instructorId" LIKE 'u-%';

DELETE FROM "VolunteerInterest"
WHERE "id" LIKE 'vi-%'
   OR "email" LIKE '%@example.com'
   OR "userId" LIKE 'u-%';

DELETE FROM "Bounty"
WHERE "requesterEmail" LIKE '%@example.com'
   OR "userId" LIKE 'u-%'
   OR "claimedByUserId" LIKE 'u-%';

DELETE FROM "CreditLedgerEntry"
WHERE "userId" LIKE 'u-%' OR "actorId" LIKE 'u-%';

DELETE FROM "EquipmentJob" WHERE "userId" LIKE 'u-%';
DELETE FROM "WorkstationLaunch" WHERE "userId" LIKE 'u-%';
DELETE FROM "WorkstationSession" WHERE "userId" LIKE 'u-%';

DELETE FROM "QuizAttempt" WHERE "userId" LIKE 'u-%';
DELETE FROM "VideoWatch" WHERE "userId" LIKE 'u-%';
DELETE FROM "LessonProgress" WHERE "userId" LIKE 'u-%';
DELETE FROM "UserCertification"
WHERE "userId" LIKE 'u-%'
   OR "checkedOffById" LIKE 'u-%'
   OR "revokedById" LIKE 'u-%';
DELETE FROM "PolicyAcknowledgement" WHERE "userId" LIKE 'u-%';
DELETE FROM "WaiverSignature" WHERE "userId" LIKE 'u-%';

DELETE FROM "Reservation"
WHERE "userId" LIKE 'u-%' OR "createdById" LIKE 'u-%';
DELETE FROM "MaintenanceBlock" WHERE "createdById" LIKE 'u-%';
DELETE FROM "UsageSession" WHERE "userId" LIKE 'u-%';
DELETE FROM "AccessLog" WHERE "userId" LIKE 'u-%';

DELETE FROM "ItemEvent" WHERE "itemId" LIKE 'inv-%' OR "actorId" LIKE 'u-%';
DELETE FROM "ItemPhoto" WHERE "itemId" LIKE 'inv-%' OR "uploadedById" LIKE 'u-%';
DELETE FROM "AreaSteward" WHERE "userId" LIKE 'u-%';
DELETE FROM "InventoryItem" WHERE "id" LIKE 'inv-%' OR "createdById" LIKE 'u-%';

DELETE FROM "PromoSlide" WHERE "id" LIKE 'promo-%';

DELETE FROM "AuditEvent"
WHERE "actorId" LIKE 'u-%' OR "subjectUserId" LIKE 'u-%';

UPDATE "User" SET "householdPrimaryUserId" = NULL
WHERE "householdPrimaryUserId" LIKE 'u-%';

DELETE FROM "User"
WHERE "id" LIKE 'u-%'
   OR "email" LIKE '%@example.com';
