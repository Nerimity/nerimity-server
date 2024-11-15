-- CreateIndex
CREATE INDEX "Attachment_messageId_createdAt_idx" ON "Attachment"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageNotification_messageId_createdAt_idx" ON "MessageNotification"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "ReplyMessages_messageId_replyToMessageId_idx" ON "ReplyMessages"("messageId", "replyToMessageId");
