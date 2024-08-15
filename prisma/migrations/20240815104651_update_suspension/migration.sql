-- AlterTable
ALTER TABLE "Suspension" ADD COLUMN     "emailHash" TEXT,
ADD COLUMN     "userDeleted" BOOLEAN DEFAULT false;
