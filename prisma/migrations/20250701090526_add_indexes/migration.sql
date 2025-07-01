-- CreateIndex
CREATE INDEX "post_likes_postId_idx" ON "post_likes"("postId");

-- CreateIndex
CREATE INDEX "posts_estimateLikes_createdAt_idx" ON "posts"("estimateLikes", "createdAt");
