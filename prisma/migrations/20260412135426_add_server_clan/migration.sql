/*
  Warnings:

  - You are about to drop the column `clanServerId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_clanServerId_fkey";

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "clanServerId" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "clanServerId";

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_clanServerId_fkey" FOREIGN KEY ("clanServerId") REFERENCES "server_clans"("serverId") ON DELETE SET NULL ON UPDATE CASCADE;
