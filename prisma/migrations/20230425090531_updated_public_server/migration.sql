/*
  Warnings:

  - Made the column `bumpedAt` on table `PublicServer` required. This step will fail if there are existing NULL values in that column.

*/


UPDATE "PublicServer" SET "bumpedAt" = timezone('UTC', now()) WHERE "bumpedAt" IS NULL;


-- AlterTable
ALTER TABLE "PublicServer" ALTER COLUMN "bumpCount" SET DEFAULT 1,
ALTER COLUMN "bumpedAt" SET NOT NULL,
ALTER COLUMN "bumpedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "lifetimeBumpCount" SET DEFAULT 1;
