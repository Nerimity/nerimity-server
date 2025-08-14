/*
  Warnings:

  - A unique constraint covering the columns `[mentionedByWebhookId,mentionedToId,channelId]` on the table `message_mentions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "message_mentions" DROP CONSTRAINT "message_mentions_mentionedById_fkey";

-- AlterTable
ALTER TABLE "message_mentions" ADD COLUMN     "mentionedByWebhookId" TEXT,
ALTER COLUMN "mentionedById" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "message_mentions_mentionedByWebhookId_mentionedToId_channel_key" ON "message_mentions"("mentionedByWebhookId", "mentionedToId", "channelId");

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_mentionedById_fkey" FOREIGN KEY ("mentionedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_mentionedByWebhookId_fkey" FOREIGN KEY ("mentionedByWebhookId") REFERENCES "webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
