-- DropForeignKey
ALTER TABLE "public"."explore" DROP CONSTRAINT "explore_botApplicationId_fkey";

-- AddForeignKey
ALTER TABLE "public"."explore" ADD CONSTRAINT "explore_botApplicationId_fkey" FOREIGN KEY ("botApplicationId") REFERENCES "public"."applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
