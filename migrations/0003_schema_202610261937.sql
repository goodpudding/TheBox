-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "kioskPinHash" TEXT,
    "kioskPinMustChange" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "User_householdPrimaryUserId_fkey" FOREIGN KEY ("householdPrimaryUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("billingInterval", "createdAt", "dayPassCreditExpiresAt", "deletedAt", "displayName", "email", "emailVerified", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "firstName", "householdPrimaryUserId", "id", "image", "isTeacher", "kioskPinHash", "lastName", "notes", "phone", "profileComplete", "role", "scholarshipExpiresAt", "shopAccess", "status", "tier", "updatedAt") SELECT "billingInterval", "createdAt", "dayPassCreditExpiresAt", "deletedAt", "displayName", "email", "emailVerified", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "firstName", "householdPrimaryUserId", "id", "image", "isTeacher", "kioskPinHash", "lastName", "notes", "phone", "profileComplete", "role", "scholarshipExpiresAt", "shopAccess", "status", "tier", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

