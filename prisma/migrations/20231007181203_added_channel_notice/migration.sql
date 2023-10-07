-- CreateTable
CREATE TABLE "ChatNotice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT,
    "userId" TEXT,
    "content" TEXT NOT NULL,

    CONSTRAINT "ChatNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatNotice_channelId_key" ON "ChatNotice"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatNotice_userId_key" ON "ChatNotice"("userId");

-- AddForeignKey
ALTER TABLE "ChatNotice" ADD CONSTRAINT "ChatNotice_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatNotice" ADD CONSTRAINT "ChatNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
