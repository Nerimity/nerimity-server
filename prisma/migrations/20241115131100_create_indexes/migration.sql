-- DropIndex
DROP INDEX "ReplyMessages_messageId_replyToMessageId_idx";

-- CreateIndex
CREATE INDEX "ReplyMessages_replyToMessageId_messageId_idx" ON "ReplyMessages"("replyToMessageId", "messageId");
