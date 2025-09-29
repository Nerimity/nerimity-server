-- CreateIndex
CREATE INDEX "attachments_messageId_idx" ON "public"."attachments"("messageId");

-- CreateIndex
CREATE INDEX "message_buttons_messageId_order_idx" ON "public"."message_buttons"("messageId", "order");

-- CreateIndex
CREATE INDEX "messages_creatorOverrideId_idx" ON "public"."messages"("creatorOverrideId");

-- CreateIndex
CREATE INDEX "messages_channelId_createdAt_id_idx" ON "public"."messages"("channelId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "reply_messages_messageId_id_idx" ON "public"."reply_messages"("messageId", "id" DESC);

-- CreateIndex
CREATE INDEX "reply_messages_replyToMessageId_idx" ON "public"."reply_messages"("replyToMessageId");
