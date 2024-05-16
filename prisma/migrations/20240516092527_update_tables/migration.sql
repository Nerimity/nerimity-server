/*
  Warnings:

  - You are about to drop the `_MessageReactionToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_MessageReactionToUser" DROP CONSTRAINT "_MessageReactionToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_MessageReactionToUser" DROP CONSTRAINT "_MessageReactionToUser_B_fkey";

-- DropTable
DROP TABLE "_MessageReactionToUser";

-- AddForeignKey
ALTER TABLE "ReactedMessageUser" ADD CONSTRAINT "ReactedMessageUser_reactionId_fkey" FOREIGN KEY ("reactionId") REFERENCES "MessageReaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactedMessageUser" ADD CONSTRAINT "ReactedMessageUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
