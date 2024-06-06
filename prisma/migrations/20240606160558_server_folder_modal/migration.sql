-- CreateTable
CREATE TABLE "ServerFolder" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT,
    "icon" TEXT,
    "serverIds" TEXT[],

    CONSTRAINT "ServerFolder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServerFolder" ADD CONSTRAINT "ServerFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
