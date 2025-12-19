-- DropIndex
DROP INDEX "reply_messages_messageId_id_idx";

-- AlterTable
ALTER TABLE "reply_messages" ADD COLUMN     "order" INTEGER;

-- CreateIndex
CREATE INDEX "reply_messages_messageId_order_idx" ON "reply_messages"("messageId", "order" DESC);
