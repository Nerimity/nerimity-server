-- CreateIndex
CREATE INDEX "followers_followedById_followedToId_idx" ON "followers"("followedById", "followedToId");

-- CreateIndex
CREATE INDEX "posts_commentToId_deleted_createdAt_createdById_idx" ON "posts"("commentToId", "deleted", "createdAt", "createdById");

-- CreateIndex
CREATE INDEX "posts_commentToId_deleted_idx" ON "posts"("commentToId", "deleted");

-- CreateIndex
CREATE INDEX "posts_repostId_idx" ON "posts"("repostId");
