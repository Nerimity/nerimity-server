-- AlterTable
ALTER TABLE "UserNotificationSettings" ADD COLUMN     "channelId" TEXT,
ALTER COLUMN "serverId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "UserNotificationSettings" ADD CONSTRAINT "UserNotificationSettings_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
