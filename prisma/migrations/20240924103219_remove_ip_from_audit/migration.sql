/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `AuditLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "ipAddress";
