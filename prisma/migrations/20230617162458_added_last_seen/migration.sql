/*
  Warnings:

  - A unique constraint covering the columns `[createdById,channelId]` on the table `Inbox` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Inbox" ADD COLUMN     "lastSeen" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Inbox_createdById_channelId_key" ON "Inbox"("createdById", "channelId");
