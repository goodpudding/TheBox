-- Gift card numbers. A printed card carries a short number; staff type it at the
-- desk to redeem the code behind it for the person holding the card. Also who
-- at the desk did it. Both columns go last: prisma/seed-data.sql is positional.
-- AlterTable
ALTER TABLE "RedemptionCode" ADD COLUMN "cardNumber" INTEGER;
ALTER TABLE "RedemptionCode" ADD COLUMN "redeemedByStaffId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RedemptionCode_cardNumber_key" ON "RedemptionCode"("cardNumber");

