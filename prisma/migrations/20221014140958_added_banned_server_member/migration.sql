-- CreateTable
CREATE TABLE "BannedServerMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "BannedServerMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BannedServerMember" ADD CONSTRAINT "BannedServerMember_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
