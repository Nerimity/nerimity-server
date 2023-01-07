-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_quotedPostId_fkey";

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "quotedPostId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_quotedPostId_fkey" FOREIGN KEY ("quotedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
