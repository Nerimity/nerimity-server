-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emojiId" TEXT,
    "gif" BOOLEAN,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MessageReactionToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_MessageReactionToUser_AB_unique" ON "_MessageReactionToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_MessageReactionToUser_B_index" ON "_MessageReactionToUser"("B");

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageReactionToUser" ADD CONSTRAINT "_MessageReactionToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "MessageReaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageReactionToUser" ADD CONSTRAINT "_MessageReactionToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
