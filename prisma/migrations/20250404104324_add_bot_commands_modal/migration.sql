-- CreateTable
CREATE TABLE "BotCommand" (
    "id" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "args" TEXT,

    CONSTRAINT "BotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotCommand_applicationId_name_idx" ON "BotCommand"("applicationId", "name");

-- CreateIndex
CREATE INDEX "BotCommand_botUserId_name_idx" ON "BotCommand"("botUserId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BotCommand_applicationId_name_key" ON "BotCommand"("applicationId", "name");

-- AddForeignKey
ALTER TABLE "BotCommand" ADD CONSTRAINT "BotCommand_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotCommand" ADD CONSTRAINT "BotCommand_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
