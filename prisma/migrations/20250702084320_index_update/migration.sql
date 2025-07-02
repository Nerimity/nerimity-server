-- CreateIndex
CREATE INDEX "attachments_postId_idx" ON "attachments"("postId");

-- CreateIndex
CREATE INDEX "posts_createdById_deleted_commentToId_createdAt_idx" ON "posts"("createdById", "deleted", "commentToId", "createdAt" DESC);
