-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "resetPasswordCode" TEXT,
ADD COLUMN     "resetPasswordCodeExpiresAt" TIMESTAMP(3);
