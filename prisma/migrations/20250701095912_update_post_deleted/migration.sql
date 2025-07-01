
-- if deleted is null, set it to false
UPDATE "posts" SET "deleted" = false WHERE "deleted" IS NULL;

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "deleted" SET NOT NULL,
ALTER COLUMN "deleted" SET DEFAULT false;
