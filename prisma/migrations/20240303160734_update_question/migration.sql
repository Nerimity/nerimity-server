/*
  Warnings:

  - Added the required column `order` to the `ServerWelcomeAnswer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `ServerWelcomeQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ServerWelcomeAnswer" ADD COLUMN     "order" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ServerWelcomeQuestion" ADD COLUMN     "order" INTEGER NOT NULL;
