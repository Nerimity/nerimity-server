-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
