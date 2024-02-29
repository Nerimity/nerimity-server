-- CreateTable
CREATE TABLE "ServerWelcomeQuestion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "multiselect" BOOLEAN NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "ServerWelcomeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerWelcomeAnswer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "roleIds" TEXT[],

    CONSTRAINT "ServerWelcomeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnsweredServerWelcomeQuestion" (
    "id" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "AnsweredServerWelcomeQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServerWelcomeQuestion" ADD CONSTRAINT "ServerWelcomeQuestion_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerWelcomeAnswer" ADD CONSTRAINT "ServerWelcomeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ServerWelcomeQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnsweredServerWelcomeQuestion" ADD CONSTRAINT "AnsweredServerWelcomeQuestion_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ServerWelcomeAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnsweredServerWelcomeQuestion" ADD CONSTRAINT "AnsweredServerWelcomeQuestion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ServerMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
