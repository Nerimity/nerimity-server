-- CreateTable
CREATE TABLE "PublicServer" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bumpCount" INTEGER NOT NULL,
    "bumpedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicServer_serverId_key" ON "PublicServer"("serverId");

-- AddForeignKey
ALTER TABLE "PublicServer" ADD CONSTRAINT "PublicServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
