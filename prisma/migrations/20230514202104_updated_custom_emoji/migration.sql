/*
  Warnings:

  - Added the required column `uploadedById` to the `CustomEmoji` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomEmoji" ADD COLUMN     "uploadedById" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "CustomEmoji" ADD CONSTRAINT "CustomEmoji_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
