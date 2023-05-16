-- CreateTable
CREATE TABLE "CustomEmoji" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "gif" BOOLEAN NOT NULL,

    CONSTRAINT "CustomEmoji_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomEmoji" ADD CONSTRAINT "CustomEmoji_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
