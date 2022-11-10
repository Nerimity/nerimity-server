-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "suspendCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Suspension" (
    "id" TEXT NOT NULL,
    "suspendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireAt" TIMESTAMP(3),
    "reason" TEXT,
    "suspendedById" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Suspension_userId_key" ON "Suspension"("userId");
