/*
  Warnings:

  - A unique constraint covering the columns `[userId,serverId]` on the table `banned_server_members` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "muted_server_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "mutedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muted_server_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "muted_server_members_serverId_mutedAt_idx" ON "muted_server_members"("serverId", "mutedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "muted_server_members_userId_serverId_key" ON "muted_server_members"("userId", "serverId");

-- CreateIndex
CREATE INDEX "banned_server_members_serverId_bannedAt_idx" ON "banned_server_members"("serverId", "bannedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "banned_server_members_userId_serverId_key" ON "banned_server_members"("userId", "serverId");

-- AddForeignKey
ALTER TABLE "muted_server_members" ADD CONSTRAINT "muted_server_members_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muted_server_members" ADD CONSTRAINT "muted_server_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
