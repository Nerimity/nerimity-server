-- CreateTable
CREATE TABLE "AnnouncementPost" (
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementPost_pkey" PRIMARY KEY ("postId")
);

-- AddForeignKey
ALTER TABLE "AnnouncementPost" ADD CONSTRAINT "AnnouncementPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
