-- CreateTable
CREATE TABLE "ShadowBan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShadowBan_userId_key" ON "ShadowBan"("userId");

-- AddForeignKey
ALTER TABLE "ShadowBan" ADD CONSTRAINT "ShadowBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
