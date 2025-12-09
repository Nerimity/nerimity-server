-- AlterTable
ALTER TABLE "banned_server_members" ADD COLUMN     "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
