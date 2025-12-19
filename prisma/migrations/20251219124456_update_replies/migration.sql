-- DropIndex
DROP INDEX "reply_messages_messageId_order_idx";

-- CreateIndex
CREATE INDEX "reply_messages_messageId_order_idx" ON "reply_messages"("messageId", "order" ASC);
