-- Redemption codes: a code staff create and one person redeems, once, for shop
-- credit, some months of a membership, or a seat in a class. A membership that
-- comes from a code has an end date; one paid for through Zeffy does not.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "membershipEndsAt" DATETIME;

-- CreateTable
CREATE TABLE "RedemptionCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER,
    "tier" TEXT,
    "months" INTEGER,
    "classSessionId" TEXT,
    "maxPriceCents" INTEGER,
    "note" TEXT,
    "zeffyPaymentId" TEXT,
    "expiresAt" DATETIME,
    "createdById" TEXT,
    "redeemedAt" DATETIME,
    "redeemedByUserId" TEXT,
    "redeemedSummary" TEXT,
    "voidedAt" DATETIME,
    "voidedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RedemptionCode_code_key" ON "RedemptionCode"("code");

-- CreateIndex
CREATE INDEX "RedemptionCode_redeemedByUserId_idx" ON "RedemptionCode"("redeemedByUserId");

