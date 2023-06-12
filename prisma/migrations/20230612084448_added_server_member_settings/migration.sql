-- CreateTable
CREATE TABLE "ServerMemberSettings" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationSoundMode" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServerMemberSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerMemberSettings_userId_serverId_key" ON "ServerMemberSettings"("userId", "serverId");

-- AddForeignKey
ALTER TABLE "ServerMemberSettings" ADD CONSTRAINT "ServerMemberSettings_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMemberSettings" ADD CONSTRAINT "ServerMemberSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
