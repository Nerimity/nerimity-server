-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastOnlineAt" TIMESTAMP(3),
ADD COLUMN     "lastOnlineStatus" INTEGER NOT NULL DEFAULT 0;
