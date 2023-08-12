-- AlterTable
ALTER TABLE "ScheduleMessageDelete" ADD COLUMN     "deletingAttachments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletingMessages" BOOLEAN NOT NULL DEFAULT true;
