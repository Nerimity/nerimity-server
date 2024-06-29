-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "hideFollowers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hideFollowing" BOOLEAN NOT NULL DEFAULT false;
