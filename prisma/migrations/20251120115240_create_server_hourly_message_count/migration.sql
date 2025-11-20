-- CreateTable
CREATE TABLE "server_hourly_message_counts" (
    "serverId" TEXT NOT NULL,
    "hourStart" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "server_hourly_message_counts_hourStart_key" ON "server_hourly_message_counts"("hourStart");

-- CreateIndex
CREATE INDEX "server_hourly_message_counts_serverId_idx" ON "server_hourly_message_counts"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "server_hourly_message_counts_serverId_hourStart_key" ON "server_hourly_message_counts"("serverId", "hourStart");

-- AddForeignKey
ALTER TABLE "server_hourly_message_counts" ADD CONSTRAINT "server_hourly_message_counts_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
