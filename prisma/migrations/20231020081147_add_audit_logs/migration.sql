-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionById" TEXT NOT NULL,
    "actionType" INTEGER NOT NULL,
    "serverName" TEXT,
    "serverId" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "ipAddress" TEXT,
    "reason" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
