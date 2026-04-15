/*
  Warnings:

  - You are about to drop the column `passwordVersion` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `botTokenVersion` on the `applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "passwordVersion";

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "botTokenVersion";
