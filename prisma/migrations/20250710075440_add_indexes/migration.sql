-- CreateIndex
CREATE INDEX "channels_serverId_idx" ON "channels"("serverId");

-- CreateIndex
CREATE INDEX "message_notifications_userId_createdAt_idx" ON "message_notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "post_notifications_postId_idx" ON "post_notifications"("postId");

-- CreateIndex
CREATE INDEX "post_notifications_toId_createdAt_idx" ON "post_notifications"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "reacted_message_users_userId_idx" ON "reacted_message_users"("userId");

-- CreateIndex
CREATE INDEX "server_invites_serverId_idx" ON "server_invites"("serverId");

-- CreateIndex
CREATE INDEX "users_tag_idx" ON "users"("tag");
