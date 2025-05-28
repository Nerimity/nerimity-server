-- AlterTable
ALTER TABLE "applications" RENAME CONSTRAINT "Application_pkey" TO "applications_pkey";

-- RenameForeignKey
ALTER TABLE "applications" RENAME CONSTRAINT "Application_botUserId_fkey" TO "applications_botUserId_fkey";

-- RenameForeignKey
ALTER TABLE "applications" RENAME CONSTRAINT "Application_creatorAccountId_fkey" TO "applications_creatorAccountId_fkey";

-- RenameIndex
ALTER INDEX "Application_botUserId_key" RENAME TO "applications_botUserId_key";
