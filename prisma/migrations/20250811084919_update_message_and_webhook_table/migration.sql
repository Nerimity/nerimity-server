/*
  Warnings:

  - Made the column `hexColor` on table `webhooks` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_createdById_fkey";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "webhookId" TEXT,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "hexColor" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
