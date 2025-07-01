-- CreateIndex
CREATE INDEX "posts_createdAt_commentToId_deleted_idx" ON "posts"("createdAt", "commentToId", "deleted");
