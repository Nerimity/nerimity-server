

DROP INDEX "ServerMemberSettings_userId_serverId_key";

ALTER TABLE "ServerMemberSettings" RENAME TO "UserNotificationSettings";

ALTER TABLE "UserNotificationSettings" RENAME CONSTRAINT "ServerMemberSettings_serverId_fkey" to "UserNotificationSettings_serverId_fkey";
ALTER TABLE "UserNotificationSettings" RENAME CONSTRAINT "ServerMemberSettings_userId_fkey" to "UserNotificationSettings_userId_fkey";

CREATE UNIQUE INDEX "UserNotificationSettings_userId_serverId_key" ON "UserNotificationSettings"("userId", "serverId");