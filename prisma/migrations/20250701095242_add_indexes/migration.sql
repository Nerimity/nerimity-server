-- CreateIndex
CREATE INDEX "posts_createdAt_createdById_commentToId_deleted_idx" ON "posts"("createdAt" DESC, "createdById", "commentToId", "deleted");
