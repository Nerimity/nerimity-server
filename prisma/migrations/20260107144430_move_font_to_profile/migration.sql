/*
  Warnings:

  - You are about to drop the column `font` on the `server_roles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "server_roles" DROP COLUMN "font";

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "font" INTEGER;
