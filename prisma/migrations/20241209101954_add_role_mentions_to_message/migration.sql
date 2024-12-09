-- CreateTable
CREATE TABLE "_role_mentioned_messages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_role_mentioned_messages_AB_unique" ON "_role_mentioned_messages"("A", "B");

-- CreateIndex
CREATE INDEX "_role_mentioned_messages_B_index" ON "_role_mentioned_messages"("B");

-- AddForeignKey
ALTER TABLE "_role_mentioned_messages" ADD CONSTRAINT "_role_mentioned_messages_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_role_mentioned_messages" ADD CONSTRAINT "_role_mentioned_messages_B_fkey" FOREIGN KEY ("B") REFERENCES "ServerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
