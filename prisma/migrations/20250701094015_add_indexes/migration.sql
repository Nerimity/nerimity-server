-- DropIndex
DROP INDEX "posts_commentToId_deleted_createdAt_createdById_idx";

-- DropIndex
DROP INDEX "posts_createdById_createdAt_idx";

-- DropIndex
DROP INDEX "posts_estimateLikes_createdAt_idx";

-- CreateIndex
CREATE INDEX "posts_commentToId_deleted_createdAt_createdById_idx" ON "posts"("commentToId", "deleted", "createdAt" DESC, "createdById");

-- CreateIndex
CREATE INDEX "posts_createdById_createdAt_idx" ON "posts"("createdById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_estimateLikes_createdAt_idx" ON "posts"("estimateLikes" DESC, "createdAt");
