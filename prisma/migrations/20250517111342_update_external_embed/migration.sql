/*
  Warnings:

  - A unique constraint covering the columns `[serverInviteCode]` on the table `ExternalEmbed` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `ServerInvite` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ExternalEmbed" ADD COLUMN     "serverInviteCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEmbed_serverInviteCode_key" ON "ExternalEmbed"("serverInviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "ServerInvite_code_key" ON "ServerInvite"("code");

-- AddForeignKey
ALTER TABLE "ExternalEmbed" ADD CONSTRAINT "ExternalEmbed_serverInviteCode_fkey" FOREIGN KEY ("serverInviteCode") REFERENCES "ServerInvite"("code") ON DELETE SET NULL ON UPDATE CASCADE;
