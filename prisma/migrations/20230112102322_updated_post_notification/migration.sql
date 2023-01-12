/*
  Warnings:

  - Made the column `postId` on table `PostLike` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "PostNotification" DROP CONSTRAINT "PostNotification_postId_fkey";

-- AlterTable
ALTER TABLE "PostLike" ALTER COLUMN "postId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PostNotification" ALTER COLUMN "postId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PostNotification" ADD CONSTRAINT "PostNotification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
