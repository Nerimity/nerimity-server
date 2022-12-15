-- AlterTable
ALTER TABLE "PublicServer" ADD COLUMN     "lifetimeBumps" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "bumpCount" SET DEFAULT 0;
