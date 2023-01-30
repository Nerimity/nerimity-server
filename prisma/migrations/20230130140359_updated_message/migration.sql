-- CreateTable
CREATE TABLE "_message_mentions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_message_mentions_AB_unique" ON "_message_mentions"("A", "B");

-- CreateIndex
CREATE INDEX "_message_mentions_B_index" ON "_message_mentions"("B");

-- AddForeignKey
ALTER TABLE "_message_mentions" ADD CONSTRAINT "_message_mentions_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_message_mentions" ADD CONSTRAINT "_message_mentions_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
