-- CreateTable
CREATE TABLE "ReplyMessages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "replyToMessageId" TEXT,

    CONSTRAINT "ReplyMessages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplyMessages_messageId_replyToMessageId_key" ON "ReplyMessages"("messageId", "replyToMessageId");

-- AddForeignKey
ALTER TABLE "ReplyMessages" ADD CONSTRAINT "ReplyMessages_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyMessages" ADD CONSTRAINT "ReplyMessages_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
