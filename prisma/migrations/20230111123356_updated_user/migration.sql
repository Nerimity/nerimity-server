/*
  Warnings:

  - A unique constraint covering the columns `[postId,likedById]` on the table `PostLike` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Follower" (
    "id" TEXT NOT NULL,
    "followedById" TEXT NOT NULL,
    "followedToId" TEXT NOT NULL,

    CONSTRAINT "Follower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Follower_followedById_followedToId_key" ON "Follower"("followedById", "followedToId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_likedById_key" ON "PostLike"("postId", "likedById");

-- AddForeignKey
ALTER TABLE "Follower" ADD CONSTRAINT "Follower_followedById_fkey" FOREIGN KEY ("followedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follower" ADD CONSTRAINT "Follower_followedToId_fkey" FOREIGN KEY ("followedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
