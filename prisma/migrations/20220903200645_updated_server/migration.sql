-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_defaultChannelId_fkey";

-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_defaultRoleId_fkey";

-- AlterTable
ALTER TABLE "Server" ALTER COLUMN "defaultChannelId" DROP NOT NULL,
ALTER COLUMN "defaultRoleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_defaultChannelId_fkey" FOREIGN KEY ("defaultChannelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_defaultRoleId_fkey" FOREIGN KEY ("defaultRoleId") REFERENCES "ServerRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
