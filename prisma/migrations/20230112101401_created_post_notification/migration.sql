-- CreateTable
CREATE TABLE "PostNotification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" INTEGER NOT NULL,
    "toId" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "PostNotification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PostNotification" ADD CONSTRAINT "PostNotification_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostNotification" ADD CONSTRAINT "PostNotification_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostNotification" ADD CONSTRAINT "PostNotification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
