/*
  Warnings:

  - Added the required column `bannedById` to the `ShadowBan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShadowBan" ADD COLUMN     "bannedById" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ShadowBan" ADD CONSTRAINT "ShadowBan_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
