-- AlterTable
ALTER TABLE "servers" ADD COLUMN "public" BOOLEAN NOT NULL DEFAULT false;

-- Set public = true where an Explore record exists for the server
UPDATE "servers" s
SET "public" = true
WHERE EXISTS (
  SELECT 1 FROM "explore" e
  WHERE e."serverId" = s."id"
);