-- AlterTable
ALTER TABLE "UserNotificationSettings" ALTER COLUMN "notificationSoundMode" DROP NOT NULL,
ALTER COLUMN "notificationSoundMode" DROP DEFAULT,
ALTER COLUMN "notificationPingMode" DROP NOT NULL,
ALTER COLUMN "notificationPingMode" DROP DEFAULT;
