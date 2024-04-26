-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_createdById_createdAt_idx" ON "Post"("createdById", "createdAt");
