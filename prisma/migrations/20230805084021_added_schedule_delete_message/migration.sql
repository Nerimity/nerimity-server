-- DropForeignKey
ALTER TABLE "Channel" DROP CONSTRAINT "Channel_serverId_fkey";

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "deleting" BOOLEAN;

-- CreateTable
CREATE TABLE "ScheduleMessageDelete" (
    "channelId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleMessageDelete_pkey" PRIMARY KEY ("channelId")
);

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
