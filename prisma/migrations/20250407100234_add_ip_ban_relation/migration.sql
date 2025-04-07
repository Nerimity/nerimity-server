-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_ipAddress_fkey" FOREIGN KEY ("ipAddress") REFERENCES "BannedIp"("ipAddress") ON DELETE CASCADE ON UPDATE CASCADE;
