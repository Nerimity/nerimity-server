-- CreateTable
CREATE TABLE "FirebaseMessagingToken" (
    "token" TEXT NOT NULL,
    "accountId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FirebaseMessagingToken_token_key" ON "FirebaseMessagingToken"("token");

-- AddForeignKey
ALTER TABLE "FirebaseMessagingToken" ADD CONSTRAINT "FirebaseMessagingToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
