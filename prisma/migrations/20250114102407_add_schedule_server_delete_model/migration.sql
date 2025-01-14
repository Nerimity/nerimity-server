-- CreateTable
CREATE TABLE "ScheduleServerDelete" (
    "serverId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleServerDelete_serverId_key" ON "ScheduleServerDelete"("serverId");

-- AddForeignKey
ALTER TABLE "ScheduleServerDelete" ADD CONSTRAINT "ScheduleServerDelete_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
