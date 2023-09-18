-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "emailConfirmCode" TEXT,
ADD COLUMN     "emailConfirmed" BOOLEAN NOT NULL DEFAULT false;
