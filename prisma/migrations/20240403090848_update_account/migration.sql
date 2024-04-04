/*
  Warnings:

  - You are about to drop the column `lastWarnedAt` on the `Account` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "lastWarnedAt",
ADD COLUMN     "warnExpiresAt" TIMESTAMP(3);
