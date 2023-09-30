-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "fileId" TEXT,
ADD COLUMN     "mime" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local',
ALTER COLUMN "path" DROP NOT NULL;
