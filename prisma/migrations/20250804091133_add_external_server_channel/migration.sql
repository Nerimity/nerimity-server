-- CreateTable
CREATE TABLE "external_server_channels" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "passwordVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_server_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_server_channels_channelId_key" ON "external_server_channels"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "external_server_channels_serverId_channelId_key" ON "external_server_channels"("serverId", "channelId");

-- AddForeignKey
ALTER TABLE "external_server_channels" ADD CONSTRAINT "external_server_channels_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_server_channels" ADD CONSTRAINT "external_server_channels_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
