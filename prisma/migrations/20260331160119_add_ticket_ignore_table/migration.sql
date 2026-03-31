-- CreateTable
CREATE TABLE "ignored_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,

    CONSTRAINT "ignored_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ignored_tickets_userId_idx" ON "ignored_tickets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ignored_tickets_userId_ticketId_key" ON "ignored_tickets"("userId", "ticketId");

-- AddForeignKey
ALTER TABLE "ignored_tickets" ADD CONSTRAINT "ignored_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignored_tickets" ADD CONSTRAINT "ignored_tickets_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
