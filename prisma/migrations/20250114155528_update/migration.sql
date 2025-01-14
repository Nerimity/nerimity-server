/*
  Warnings:

  - Added the required column `scheduledByUserId` to the `ScheduleServerDelete` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ScheduleServerDelete" ADD COLUMN     "scheduledByUserId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ScheduleServerDelete" ADD CONSTRAINT "ScheduleServerDelete_scheduledByUserId_fkey" FOREIGN KEY ("scheduledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
