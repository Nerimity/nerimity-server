/*
  Warnings:

  - You are about to drop the `server_member_clans` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "server_member_clans" DROP CONSTRAINT "server_member_clans_serverId_fkey";

-- DropForeignKey
ALTER TABLE "server_member_clans" DROP CONSTRAINT "server_member_clans_serverMemberId_fkey";

-- DropForeignKey
ALTER TABLE "server_member_clans" DROP CONSTRAINT "server_member_clans_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "clanServerId" TEXT;

-- DropTable
DROP TABLE "server_member_clans";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clanServerId_fkey" FOREIGN KEY ("clanServerId") REFERENCES "server_clans"("serverId") ON DELETE SET NULL ON UPDATE CASCADE;
