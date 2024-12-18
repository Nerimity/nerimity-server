-- AlterTable
ALTER TABLE "_ServerToUser" ADD CONSTRAINT "_ServerToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ServerToUser_AB_unique";

-- AlterTable
ALTER TABLE "_mentioned_messages" ADD CONSTRAINT "_mentioned_messages_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_mentioned_messages_AB_unique";

-- AlterTable
ALTER TABLE "_quoted_messages" ADD CONSTRAINT "_quoted_messages_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_quoted_messages_AB_unique";

-- AlterTable
ALTER TABLE "_role_mentioned_messages" ADD CONSTRAINT "_role_mentioned_messages_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_role_mentioned_messages_AB_unique";
