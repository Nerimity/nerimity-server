-- CreateTable
CREATE TABLE "MessageButton" (
    "order" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "alert" BOOLEAN,

    CONSTRAINT "MessageButton_pkey" PRIMARY KEY ("messageId","id")
);

-- AddForeignKey
ALTER TABLE "MessageButton" ADD CONSTRAINT "MessageButton_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
