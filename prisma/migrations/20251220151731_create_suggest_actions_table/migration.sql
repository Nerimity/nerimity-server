-- CreateTable
CREATE TABLE "mod_suggest_actions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionType" INTEGER NOT NULL,
    "suggestById" TEXT NOT NULL,
    "serverId" TEXT,
    "postId" TEXT,
    "userId" TEXT,
    "reason" TEXT,

    CONSTRAINT "mod_suggest_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mod_suggest_actions_serverId_key" ON "mod_suggest_actions"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "mod_suggest_actions_postId_key" ON "mod_suggest_actions"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "mod_suggest_actions_userId_key" ON "mod_suggest_actions"("userId");

-- AddForeignKey
ALTER TABLE "mod_suggest_actions" ADD CONSTRAINT "mod_suggest_actions_suggestById_fkey" FOREIGN KEY ("suggestById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_suggest_actions" ADD CONSTRAINT "mod_suggest_actions_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_suggest_actions" ADD CONSTRAINT "mod_suggest_actions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_suggest_actions" ADD CONSTRAINT "mod_suggest_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
