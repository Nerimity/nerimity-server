-- CreateTable
CREATE TABLE "_quoted_messages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_quoted_messages_AB_unique" ON "_quoted_messages"("A", "B");

-- CreateIndex
CREATE INDEX "_quoted_messages_B_index" ON "_quoted_messages"("B");

-- AddForeignKey
ALTER TABLE "_quoted_messages" ADD CONSTRAINT "_quoted_messages_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_quoted_messages" ADD CONSTRAINT "_quoted_messages_B_fkey" FOREIGN KEY ("B") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
