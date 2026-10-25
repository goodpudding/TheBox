-- CreateTable
CREATE TABLE "MachineRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "memberCentsPerUnit" REAL NOT NULL,
    "nonmemberCentsPerUnit" REAL,
    "memberMinimumCents" INTEGER NOT NULL DEFAULT 0,
    "nonmemberMinimumCents" INTEGER NOT NULL DEFAULT 0,
    "roundingMinutes" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MachineRate_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "filePath" TEXT,
    "estMinutes" INTEGER,
    "estGrams" REAL,
    "estUnits" REAL,
    "listCents" INTEGER NOT NULL,
    "creditAppliedCents" INTEGER NOT NULL DEFAULT 0,
    "chargedCents" INTEGER NOT NULL,
    "refundCents" INTEGER NOT NULL DEFAULT 0,
    "refundReason" TEXT,
    "rateSnapshot" JSONB NOT NULL,
    "denyReason" TEXT,
    "staffOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideNote" TEXT,
    "releasedAt" DATETIME,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "printerSerial" TEXT,
    "printerProgress" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MachineJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MachineJob_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deltaCents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "jobId" TEXT,
    "note" TEXT,
    "periodKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditLedger_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MachineJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'A1',
    "lastSeenAt" DATETIME,
    "state" TEXT,
    CONSTRAINT "Printer_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MembershipProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "annualPriceCents" INTEGER,
    "shopAccess" BOOLEAN NOT NULL DEFAULT true,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "visibleOnJoin" BOOLEAN NOT NULL DEFAULT true,
    "joinable" BOOLEAN NOT NULL DEFAULT true,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAddOn" BOOLEAN NOT NULL DEFAULT false,
    "cappedSeats" INTEGER,
    "monthlyCreditCents" INTEGER NOT NULL DEFAULT 0,
    "creditRolloverCapCents" INTEGER,
    "unlimitedMachines" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_MembershipProduct" ("annualPriceCents", "billingInterval", "cappedSeats", "createdAt", "deletedAt", "highlight", "id", "isAddOn", "joinable", "name", "phase", "priceCents", "shopAccess", "sortOrder", "summary", "tier", "updatedAt", "visibleOnJoin") SELECT "annualPriceCents", "billingInterval", "cappedSeats", "createdAt", "deletedAt", "highlight", "id", "isAddOn", "joinable", "name", "phase", "priceCents", "shopAccess", "sortOrder", "summary", "tier", "updatedAt", "visibleOnJoin" FROM "MembershipProduct";
DROP TABLE "MembershipProduct";
ALTER TABLE "new_MembershipProduct" RENAME TO "MembershipProduct";
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
    "maxBalanceOwedCents" INTEGER NOT NULL DEFAULT 5000,
    "nonmemberMultiplier" REAL NOT NULL DEFAULT 1.5,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OrgSettings" ("classCancellationCutoffHours", "communitySeatCap", "contactEmail", "currentWaiverVersion", "donationUrl", "hoursContentSlug", "id", "makerMonthlyCents", "maxHoursPerDay", "maxOpenReservations", "memberExpectationsPolicySlug", "orgName", "patronScholarshipSurchargeCents", "paymentHoldHours", "paymentUrl", "quizAttemptLimit", "quizPassThresholdPercent", "quizQuestionCount", "requireSafetyCriticalAll", "reservationHorizonDays", "reservationSlotMinutes", "scholarshipDonationUrl", "scholarshipFundBalanceCents", "scholarshipSeatsAwarded", "showPhase3Tiers", "updatedAt") SELECT "classCancellationCutoffHours", "communitySeatCap", "contactEmail", "currentWaiverVersion", "donationUrl", "hoursContentSlug", "id", "makerMonthlyCents", "maxHoursPerDay", "maxOpenReservations", "memberExpectationsPolicySlug", "orgName", "patronScholarshipSurchargeCents", "paymentHoldHours", "paymentUrl", "quizAttemptLimit", "quizPassThresholdPercent", "quizQuestionCount", "requireSafetyCriticalAll", "reservationHorizonDays", "reservationSlotMinutes", "scholarshipDonationUrl", "scholarshipFundBalanceCents", "scholarshipSeatsAwarded", "showPhase3Tiers", "updatedAt" FROM "OrgSettings";
DROP TABLE "OrgSettings";
ALTER TABLE "new_OrgSettings" RENAME TO "OrgSettings";
CREATE TABLE "new_UsageSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "badgeId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "reservationId" TEXT,
    "endedBy" TEXT NOT NULL,
    "jobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UsageSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UsageSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MachineJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UsageSession" ("badgeId", "createdAt", "deletedAt", "endedAt", "endedBy", "id", "machineId", "reservationId", "startedAt", "updatedAt", "userId") SELECT "badgeId", "createdAt", "deletedAt", "endedAt", "endedBy", "id", "machineId", "reservationId", "startedAt", "updatedAt", "userId" FROM "UsageSession";
DROP TABLE "UsageSession";
ALTER TABLE "new_UsageSession" RENAME TO "UsageSession";
CREATE UNIQUE INDEX "UsageSession_jobId_key" ON "UsageSession"("jobId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tier" TEXT,
    "billingInterval" TEXT,
    "householdPrimaryUserId" TEXT,
    "shopAccess" BOOLEAN NOT NULL DEFAULT false,
    "isTeacher" BOOLEAN NOT NULL DEFAULT false,
    "dayPassCreditExpiresAt" DATETIME,
    "scholarshipExpiresAt" DATETIME,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "balanceOwedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "User_householdPrimaryUserId_fkey" FOREIGN KEY ("householdPrimaryUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("billingInterval", "createdAt", "dayPassCreditExpiresAt", "deletedAt", "displayName", "email", "emailVerified", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "firstName", "householdPrimaryUserId", "id", "image", "isTeacher", "lastName", "notes", "phone", "profileComplete", "role", "scholarshipExpiresAt", "shopAccess", "status", "tier", "updatedAt") SELECT "billingInterval", "createdAt", "dayPassCreditExpiresAt", "deletedAt", "displayName", "email", "emailVerified", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "firstName", "householdPrimaryUserId", "id", "image", "isTeacher", "lastName", "notes", "phone", "profileComplete", "role", "scholarshipExpiresAt", "shopAccess", "status", "tier", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MachineRate_machineId_key" ON "MachineRate"("machineId");

-- CreateIndex
CREATE INDEX "MachineJob_userId_createdAt_idx" ON "MachineJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MachineJob_machineId_status_idx" ON "MachineJob"("machineId", "status");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_periodKey_idx" ON "CreditLedger"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Printer_machineId_key" ON "Printer"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "Printer_serial_key" ON "Printer"("serial");
