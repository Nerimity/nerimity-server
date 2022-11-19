-- AddForeignKey
ALTER TABLE "BannedServerMember" ADD CONSTRAINT "BannedServerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
