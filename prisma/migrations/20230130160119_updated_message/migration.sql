/*
  Warnings:

  - You are about to drop the `_message_mentions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_message_mentions" DROP CONSTRAINT "_message_mentions_A_fkey";

-- DropForeignKey
ALTER TABLE "_message_mentions" DROP CONSTRAINT "_message_mentions_B_fkey";

-- DropTable
DROP TABLE "_message_mentions";

-- CreateTable
CREATE TABLE "_mentioned_messages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_mentioned_messages_AB_unique" ON "_mentioned_messages"("A", "B");

-- CreateIndex
CREATE INDEX "_mentioned_messages_B_index" ON "_mentioned_messages"("B");

-- AddForeignKey
ALTER TABLE "_mentioned_messages" ADD CONSTRAINT "_mentioned_messages_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_mentioned_messages" ADD CONSTRAINT "_mentioned_messages_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
