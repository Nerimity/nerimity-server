/*
  Warnings:

  - You are about to drop the column `pingNotificationMode` on the `ServerMemberSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ServerMemberSettings" DROP COLUMN "pingNotificationMode",
ADD COLUMN     "notificationPingMode" INTEGER NOT NULL DEFAULT 0;
