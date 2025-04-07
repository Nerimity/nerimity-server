/*
  Warnings:

  - A unique constraint covering the columns `[userId,ipAddress]` on the table `UserDevice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex


TRUNCATE "UserDevice";
CREATE UNIQUE INDEX "UserDevice_userId_ipAddress_key" ON "UserDevice"("userId", "ipAddress");
