/*
  Warnings:

  - A unique constraint covering the columns `[userId,serverId]` on the table `ServerMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ServerMember_userId_serverId_key" ON "ServerMember"("userId", "serverId");
