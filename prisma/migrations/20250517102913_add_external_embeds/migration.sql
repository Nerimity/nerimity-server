-- CreateTable
CREATE TABLE "ExternalEmbed" (
    "id" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "serverId" TEXT,
    "userId" TEXT,

    CONSTRAINT "ExternalEmbed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEmbed_serverId_key" ON "ExternalEmbed"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEmbed_userId_key" ON "ExternalEmbed"("userId");

-- AddForeignKey
ALTER TABLE "ExternalEmbed" ADD CONSTRAINT "ExternalEmbed_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalEmbed" ADD CONSTRAINT "ExternalEmbed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
