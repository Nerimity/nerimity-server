/*
  Warnings:

  - You are about to drop the column `lifetimeBumps` on the `PublicServer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PublicServer" DROP COLUMN "lifetimeBumps",
ADD COLUMN     "lifetimeBumpCount" INTEGER NOT NULL DEFAULT 0;
