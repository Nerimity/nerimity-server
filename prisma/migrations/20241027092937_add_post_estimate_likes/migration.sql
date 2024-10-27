-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "estimateLikes" INTEGER NOT NULL DEFAULT 0;


-- Populate estimateLikes

UPDATE "Post" 
SET "estimateLikes" = (SELECT COUNT(*) FROM "PostLike" WHERE "PostLike"."postId" = "Post"."id")
WHERE deleted IS NULL;