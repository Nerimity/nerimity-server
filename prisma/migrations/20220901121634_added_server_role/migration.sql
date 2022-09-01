-- AlterTable
ALTER TABLE "ServerMember" ADD COLUMN     "roleIds" TEXT[];

-- CreateTable
CREATE TABLE "ServerRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hexColor" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerRole_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServerRole" ADD CONSTRAINT "ServerRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRole" ADD CONSTRAINT "ServerRole_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
