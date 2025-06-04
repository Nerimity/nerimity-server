-- CreateTable
CREATE TABLE "server_folders" (
    "id" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serverIds" TEXT[],
    "accountId" TEXT NOT NULL,

    CONSTRAINT "server_folders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "server_folders" ADD CONSTRAINT "server_folders_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
