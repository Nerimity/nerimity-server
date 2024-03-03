/*
  Warnings:

  - A unique constraint covering the columns `[memberId,answerId]` on the table `AnsweredServerWelcomeQuestion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `questionId` to the `AnsweredServerWelcomeQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AnsweredServerWelcomeQuestion" ADD COLUMN     "questionId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AnsweredServerWelcomeQuestion_memberId_answerId_key" ON "AnsweredServerWelcomeQuestion"("memberId", "answerId");

-- AddForeignKey
ALTER TABLE "AnsweredServerWelcomeQuestion" ADD CONSTRAINT "AnsweredServerWelcomeQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ServerWelcomeQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
