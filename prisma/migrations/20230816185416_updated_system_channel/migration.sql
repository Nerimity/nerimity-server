/*
  Warnings:

  - A unique constraint covering the columns `[systemChannelId]` on the table `Server` will be added. If there are existing duplicate values, this will fail.

*/
UPDATE "Server"
SET "systemChannelId" = NULL
WHERE "systemChannelId" NOT IN (SELECT id FROM "Channel");


-- CreateIndex
CREATE UNIQUE INDEX "Server_systemChannelId_key" ON "Server"("systemChannelId");

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_systemChannelId_fkey" FOREIGN KEY ("systemChannelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
