/*
  Warnings:

  - A unique constraint covering the columns `[userId,ipAddress,sessionId]` on the table `user_devices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user_devices" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_ipAddress_sessionId_key" ON "user_devices"("userId", "ipAddress", "sessionId");
