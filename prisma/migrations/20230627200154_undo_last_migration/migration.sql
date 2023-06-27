/*
  Warnings:

  - Made the column `email` on table `Account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `password` on table `Account` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password" SET NOT NULL;
