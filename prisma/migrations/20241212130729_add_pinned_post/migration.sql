-- CreateTable
CREATE TABLE "PinnedPost" (
    "postId" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedPost_pkey" PRIMARY KEY ("postId")
);

-- AddForeignKey
ALTER TABLE "PinnedPost" ADD CONSTRAINT "PinnedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinnedPost" ADD CONSTRAINT "PinnedPost_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
