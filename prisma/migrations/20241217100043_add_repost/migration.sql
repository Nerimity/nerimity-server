-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "estimateReposts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repostId" TEXT;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
