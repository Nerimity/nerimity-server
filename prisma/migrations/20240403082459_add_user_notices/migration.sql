-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "lastWarnedAt" TIMESTAMP(3),
ADD COLUMN     "warnCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserNotice" (
    "id" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserNotice" ADD CONSTRAINT "UserNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotice" ADD CONSTRAINT "UserNotice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
