-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "post_likes_likedById_idx" ON "post_likes"("likedById");
