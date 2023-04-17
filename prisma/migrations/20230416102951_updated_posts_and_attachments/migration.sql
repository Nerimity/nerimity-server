-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "postId" TEXT,
ALTER COLUMN "messageId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
