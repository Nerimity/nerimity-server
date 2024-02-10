-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "botUserId" TEXT,
    "creatorAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_botUserId_key" ON "Application"("botUserId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_creatorAccountId_fkey" FOREIGN KEY ("creatorAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
