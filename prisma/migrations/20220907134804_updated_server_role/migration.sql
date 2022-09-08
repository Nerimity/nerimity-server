/*
  Warnings:

  - Added the required column `permissions` to the `ServerRole` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ServerRole" ADD COLUMN     "permissions" INTEGER NOT NULL;
