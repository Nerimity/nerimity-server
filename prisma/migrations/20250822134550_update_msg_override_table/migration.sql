/*
  Warnings:

  - You are about to drop the column `authorOverrideId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `message_author_overrides` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_authorOverrideId_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "authorOverrideId",
ADD COLUMN     "creatorOverrideId" INTEGER;

-- DropTable
DROP TABLE "message_author_overrides";

-- CreateTable
CREATE TABLE "message_creator_overrides" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "message_creator_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_creator_overrides_username_avatarUrl_key" ON "message_creator_overrides"("username", "avatarUrl");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_creatorOverrideId_fkey" FOREIGN KEY ("creatorOverrideId") REFERENCES "message_creator_overrides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
