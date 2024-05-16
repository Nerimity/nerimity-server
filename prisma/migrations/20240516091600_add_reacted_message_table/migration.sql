-- CreateTable
CREATE TABLE "ReactedMessageUser" (
    "reactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ReactedMessageUser_reactionId_userId_key" ON "ReactedMessageUser"("reactionId", "userId");


-- Move all data from _MessageReactionToUser to ReactedMessageUser
INSERT INTO "ReactedMessageUser" ("reactionId", "userId") SELECT "A", "B" FROM public."_MessageReactionToUser";