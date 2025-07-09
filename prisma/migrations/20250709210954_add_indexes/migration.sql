-- CreateIndex
CREATE INDEX "attachments_channelId_idx" ON "attachments"("channelId");

-- CreateIndex
CREATE INDEX "custom_emojis_serverId_idx" ON "custom_emojis"("serverId");

-- CreateIndex
CREATE INDEX "fcm_tokens_accountId_idx" ON "fcm_tokens"("accountId");

-- CreateIndex
CREATE INDEX "followers_followedToId_idx" ON "followers"("followedToId");

-- CreateIndex
CREATE INDEX "message_mentions_mentionedToId_idx" ON "message_mentions"("mentionedToId");

-- CreateIndex
CREATE INDEX "server_channel_last_seen_userId_idx" ON "server_channel_last_seen"("userId");

-- CreateIndex
CREATE INDEX "server_channel_permissions_channelId_idx" ON "server_channel_permissions"("channelId");

-- CreateIndex
CREATE INDEX "server_members_serverId_idx" ON "server_members"("serverId");

-- CreateIndex
CREATE INDEX "server_roles_serverId_idx" ON "server_roles"("serverId");
