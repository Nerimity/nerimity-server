-- CreateTable
CREATE TABLE "_mentioned_posts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_mentioned_posts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_mentioned_posts_B_index" ON "_mentioned_posts"("B");

-- AddForeignKey
ALTER TABLE "_mentioned_posts" ADD CONSTRAINT "_mentioned_posts_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_mentioned_posts" ADD CONSTRAINT "_mentioned_posts_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
