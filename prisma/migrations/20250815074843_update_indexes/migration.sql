-- CreateIndex
CREATE INDEX "attachments_serverId_idx" ON "attachments"("serverId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "channels_categoryId_idx" ON "channels"("categoryId");

-- CreateIndex
CREATE INDEX "inboxes_channelId_idx" ON "inboxes"("channelId");

-- CreateIndex
CREATE INDEX "message_mentions_channelId_idx" ON "message_mentions"("channelId");

-- CreateIndex
CREATE INDEX "message_mentions_serverId_idx" ON "message_mentions"("serverId");

-- CreateIndex
CREATE INDEX "message_notifications_serverId_idx" ON "message_notifications"("serverId");

-- CreateIndex
CREATE INDEX "messages_channelId_id_idx" ON "messages"("channelId", "id");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "messages_webhookId_idx" ON "messages"("webhookId");

-- CreateIndex
CREATE INDEX "mod_audit_logs_createdAt_idx" ON "mod_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "post_notifications_byId_idx" ON "post_notifications"("byId");

-- CreateIndex
CREATE INDEX "post_poll_voted_users_userId_idx" ON "post_poll_voted_users"("userId");

-- CreateIndex
CREATE INDEX "posts_quotedPostId_idx" ON "posts"("quotedPostId");

-- CreateIndex
CREATE INDEX "public_servers_bumpedAt_idx" ON "public_servers"("bumpedAt");

-- CreateIndex
CREATE INDEX "server_channel_last_seen_serverId_idx" ON "server_channel_last_seen"("serverId");

-- CreateIndex
CREATE INDEX "server_channel_permissions_serverId_idx" ON "server_channel_permissions"("serverId");

-- CreateIndex
CREATE INDEX "servers_createdAt_idx" ON "servers"("createdAt");

-- CreateIndex
CREATE INDEX "user_devices_ipAddress_idx" ON "user_devices"("ipAddress");

-- CreateIndex
CREATE INDEX "users_joinedAt_idx" ON "users"("joinedAt");
