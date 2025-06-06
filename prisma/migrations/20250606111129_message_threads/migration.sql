-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "threadMessageId" TEXT;

-- CreateIndex
CREATE INDEX "messages_threadMessageId_idx" ON "messages"("threadMessageId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_threadMessageId_fkey" FOREIGN KEY ("threadMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
