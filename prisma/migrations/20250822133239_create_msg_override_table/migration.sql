-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "authorOverrideId" INTEGER;

-- CreateTable
CREATE TABLE "message_author_overrides" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "message_author_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_author_overrides_username_avatarUrl_key" ON "message_author_overrides"("username", "avatarUrl");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_authorOverrideId_fkey" FOREIGN KEY ("authorOverrideId") REFERENCES "message_author_overrides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
