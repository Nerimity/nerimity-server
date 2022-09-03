/*
  Warnings:

  - Made the column `defaultChannelId` on table `Server` required. This step will fail if there are existing NULL values in that column.
  - Made the column `defaultRoleId` on table `Server` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_defaultChannelId_fkey";

-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_defaultRoleId_fkey";

-- DropIndex
DROP INDEX "Server_defaultChannelId_key";

-- DropIndex
DROP INDEX "Server_defaultRoleId_key";

-- AlterTable
ALTER TABLE "Server" ALTER COLUMN "defaultChannelId" SET NOT NULL,
ALTER COLUMN "defaultRoleId" SET NOT NULL;
