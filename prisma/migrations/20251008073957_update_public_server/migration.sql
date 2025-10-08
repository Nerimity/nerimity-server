/*
  Warnings:

  - A unique constraint covering the columns `[botApplicationId]` on the table `public_servers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."applications" ADD COLUMN     "public" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."public_servers" ADD COLUMN     "botApplicationId" TEXT,
ADD COLUMN     "type" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "public_servers_botApplicationId_key" ON "public"."public_servers"("botApplicationId");

-- CreateIndex
CREATE INDEX "public_servers_type_idx" ON "public"."public_servers"("type");

-- AddForeignKey
ALTER TABLE "public"."public_servers" ADD CONSTRAINT "public_servers_botApplicationId_fkey" FOREIGN KEY ("botApplicationId") REFERENCES "public"."applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
