-- DropForeignKey
ALTER TABLE "PostPollChoice" DROP CONSTRAINT "PostPollChoice_pollId_fkey";

-- DropForeignKey
ALTER TABLE "PostPollVotedUser" DROP CONSTRAINT "PostPollVotedUser_pollChoiceId_fkey";

-- DropForeignKey
ALTER TABLE "PostPollVotedUser" DROP CONSTRAINT "PostPollVotedUser_pollId_fkey";

-- AddForeignKey
ALTER TABLE "PostPollChoice" ADD CONSTRAINT "PostPollChoice_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "PostPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVotedUser" ADD CONSTRAINT "PostPollVotedUser_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "PostPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVotedUser" ADD CONSTRAINT "PostPollVotedUser_pollChoiceId_fkey" FOREIGN KEY ("pollChoiceId") REFERENCES "PostPollChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
