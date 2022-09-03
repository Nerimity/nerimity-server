/*
  Warnings:

  - You are about to drop the column `defaultRole` on the `ServerRole` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[defaultChannelId]` on the table `Server` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[defaultRoleId]` on the table `Server` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `defaultRoleId` to the `Server` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "defaultRoleId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ServerRole" DROP COLUMN "defaultRole";

-- CreateIndex
CREATE UNIQUE INDEX "Server_defaultChannelId_key" ON "Server"("defaultChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Server_defaultRoleId_key" ON "Server"("defaultRoleId");

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_defaultChannelId_fkey" FOREIGN KEY ("defaultChannelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_defaultRoleId_fkey" FOREIGN KEY ("defaultRoleId") REFERENCES "ServerRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
