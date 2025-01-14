-- DropForeignKey
ALTER TABLE "ScheduleServerDelete" DROP CONSTRAINT "ScheduleServerDelete_serverId_fkey";

-- AddForeignKey
ALTER TABLE "ScheduleServerDelete" ADD CONSTRAINT "ScheduleServerDelete_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
