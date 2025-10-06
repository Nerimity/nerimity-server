-- DropIndex
DROP INDEX "public"."post_likes_likedById_idx";

-- CreateIndex
CREATE INDEX "post_likes_likedById_createdAt_idx" ON "public"."post_likes"("likedById", "createdAt" DESC);
