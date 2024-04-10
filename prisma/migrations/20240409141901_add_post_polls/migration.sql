-- CreateTable
CREATE TABLE "PostPoll" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "PostPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPollChoice" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "PostPollChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPollVotedUser" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "pollChoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PostPollVotedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostPoll_postId_key" ON "PostPoll"("postId");

-- AddForeignKey
ALTER TABLE "PostPoll" ADD CONSTRAINT "PostPoll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollChoice" ADD CONSTRAINT "PostPollChoice_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "PostPoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVotedUser" ADD CONSTRAINT "PostPollVotedUser_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "PostPoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVotedUser" ADD CONSTRAINT "PostPollVotedUser_pollChoiceId_fkey" FOREIGN KEY ("pollChoiceId") REFERENCES "PostPollChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVotedUser" ADD CONSTRAINT "PostPollVotedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
