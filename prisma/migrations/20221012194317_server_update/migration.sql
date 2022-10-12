/*
  Warnings:

  - Added the required column `systemChannelId` to the `Server` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Server" ADD COLUMN "systemChannelId" TEXT;
UPDATE "Server" SET "systemChannelId" = "defaultChannelId";
ALTER TABLE "Server" ALTER COLUMN "systemChannelId" SET NOT NULL;
