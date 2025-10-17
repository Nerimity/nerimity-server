-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "pinned" BOOLEAN;

-- CreateTable
CREATE TABLE "public"."pinned_messages" (
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "pinned_messages_messageId_key" ON "public"."pinned_messages"("messageId");

-- CreateIndex
CREATE INDEX "pinned_messages_channelId_pinnedAt_idx" ON "public"."pinned_messages"("channelId", "pinnedAt" DESC);

-- AddForeignKey
ALTER TABLE "public"."pinned_messages" ADD CONSTRAINT "pinned_messages_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages" ADD CONSTRAINT "pinned_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
