-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClassSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descriptionSlug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "zeffyUrl" TEXT,
    "zeffyCampaignId" TEXT,
    "zeffyOccurrenceId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "googleEventId" TEXT,
    "googleCalendarId" TEXT,
    "syncedAt" DATETIME,
    "cancelledAt" DATETIME,
    "staffEditedFields" TEXT,
    "prerequisiteCertificationIds" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "cancellationCutoffHours" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ClassSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ClassSession" ("cancellationCutoffHours", "capacity", "category", "createdAt", "deletedAt", "descriptionSlug", "endsAt", "id", "instructorId", "location", "prerequisiteCertificationIds", "priceCents", "published", "slug", "startsAt", "title", "updatedAt", "zeffyCampaignId", "zeffyUrl") SELECT "cancellationCutoffHours", "capacity", "category", "createdAt", "deletedAt", "descriptionSlug", "endsAt", "id", "instructorId", "location", "prerequisiteCertificationIds", "priceCents", "published", "slug", "startsAt", "title", "updatedAt", "zeffyCampaignId", "zeffyUrl" FROM "ClassSession";
DROP TABLE "ClassSession";
ALTER TABLE "new_ClassSession" RENAME TO "ClassSession";
CREATE UNIQUE INDEX "ClassSession_slug_key" ON "ClassSession"("slug");
CREATE INDEX "ClassSession_zeffyCampaignId_idx" ON "ClassSession"("zeffyCampaignId");
CREATE UNIQUE INDEX "ClassSession_zeffyCampaignId_zeffyOccurrenceId_key" ON "ClassSession"("zeffyCampaignId", "zeffyOccurrenceId");
CREATE TABLE "new_OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "orgName" TEXT NOT NULL,
    "paymentUrl" TEXT NOT NULL,
    "donationUrl" TEXT NOT NULL,
    "scholarshipDonationUrl" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "hoursContentSlug" TEXT NOT NULL,
    "currentWaiverVersion" TEXT NOT NULL,
    "memberExpectationsPolicySlug" TEXT NOT NULL,
    "quizPassThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "quizAttemptLimit" INTEGER NOT NULL DEFAULT 3,
    "quizQuestionCount" INTEGER NOT NULL DEFAULT 10,
    "requireSafetyCriticalAll" BOOLEAN NOT NULL DEFAULT true,
    "classCancellationCutoffHours" INTEGER NOT NULL DEFAULT 24,
    "paymentHoldHours" INTEGER NOT NULL DEFAULT 48,
    "reservationHorizonDays" INTEGER NOT NULL DEFAULT 14,
    "maxHoursPerDay" INTEGER NOT NULL DEFAULT 3,
    "maxOpenReservations" INTEGER NOT NULL DEFAULT 3,
    "reservationSlotMinutes" INTEGER NOT NULL DEFAULT 30,
    "communitySeatCap" INTEGER NOT NULL DEFAULT 12,
    "makerMonthlyCents" INTEGER NOT NULL DEFAULT 4000,
    "patronScholarshipSurchargeCents" INTEGER NOT NULL DEFAULT 2000,
    "scholarshipFundBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "scholarshipSeatsAwarded" INTEGER NOT NULL DEFAULT 0,
    "showPhase3Tiers" BOOLEAN NOT NULL DEFAULT true,
    "defaultInstructorId" TEXT,
    "defaultClassCapacity" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrgSettings_defaultInstructorId_fkey" FOREIGN KEY ("defaultInstructorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrgSettings" ("classCancellationCutoffHours", "communitySeatCap", "contactEmail", "currentWaiverVersion", "donationUrl", "hoursContentSlug", "id", "makerMonthlyCents", "maxHoursPerDay", "maxOpenReservations", "memberExpectationsPolicySlug", "orgName", "patronScholarshipSurchargeCents", "paymentHoldHours", "paymentUrl", "quizAttemptLimit", "quizPassThresholdPercent", "quizQuestionCount", "requireSafetyCriticalAll", "reservationHorizonDays", "reservationSlotMinutes", "scholarshipDonationUrl", "scholarshipFundBalanceCents", "scholarshipSeatsAwarded", "showPhase3Tiers", "updatedAt") SELECT "classCancellationCutoffHours", "communitySeatCap", "contactEmail", "currentWaiverVersion", "donationUrl", "hoursContentSlug", "id", "makerMonthlyCents", "maxHoursPerDay", "maxOpenReservations", "memberExpectationsPolicySlug", "orgName", "patronScholarshipSurchargeCents", "paymentHoldHours", "paymentUrl", "quizAttemptLimit", "quizPassThresholdPercent", "quizQuestionCount", "requireSafetyCriticalAll", "reservationHorizonDays", "reservationSlotMinutes", "scholarshipDonationUrl", "scholarshipFundBalanceCents", "scholarshipSeatsAwarded", "showPhase3Tiers", "updatedAt" FROM "OrgSettings";
DROP TABLE "OrgSettings";
ALTER TABLE "new_OrgSettings" RENAME TO "OrgSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

