-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "deleted" BOOLEAN,
ALTER COLUMN "content" DROP NOT NULL;
