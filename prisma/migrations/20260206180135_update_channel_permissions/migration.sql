/*
  Warnings:

  - A unique constraint covering the columns `[memberId,channelId]` on the table `server_channel_permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roleId,channelId]` on the table `server_channel_permissions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "server_channel_permissions_channelId_idx";

-- AlterTable
ALTER TABLE "server_channel_permissions" ADD COLUMN     "memberId" TEXT;

-- CreateIndex
CREATE INDEX "server_channel_permissions_channelId_serverId_idx" ON "server_channel_permissions"("channelId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "server_channel_permissions_memberId_channelId_key" ON "server_channel_permissions"("memberId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "server_channel_permissions_roleId_channelId_key" ON "server_channel_permissions"("roleId", "channelId");

-- AddForeignKey
ALTER TABLE "server_channel_permissions" ADD CONSTRAINT "server_channel_permissions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "server_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
