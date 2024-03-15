-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
