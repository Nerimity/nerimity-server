/*
  This script renames 'public_servers' to 'explore' by dropping all original
  constraints/indexes and then recreating them with the new names.
  WARNING: This can be slow on large tables.
*/

-- Step 1: Drop all constraints and indexes from the old table.
-- Note: It's often safest to drop foreign keys first.
ALTER TABLE "public"."public_servers" DROP CONSTRAINT "public_servers_botApplicationId_fkey";
ALTER TABLE "public"."public_servers" DROP CONSTRAINT "public_servers_serverId_fkey";
ALTER TABLE "public"."public_servers" DROP CONSTRAINT "public_servers_pkey";
DROP INDEX "public"."public_servers_serverId_key";
DROP INDEX "public"."public_servers_botApplicationId_key";
DROP INDEX "public"."public_servers_type_idx";
DROP INDEX "public"."public_servers_bumpedAt_idx";

-- Step 2: Rename the table (it's now just raw data without indexes).
ALTER TABLE "public"."public_servers" RENAME TO "explore";

-- Step 3: Add the primary key and create all indexes on the new table.
-- This part is taken directly from the original Prisma-generated migration.
ALTER TABLE "public"."explore" ADD CONSTRAINT "explore_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "explore_serverId_key" ON "public"."explore"("serverId");
CREATE UNIQUE INDEX "explore_botApplicationId_key" ON "public"."explore"("botApplicationId");
CREATE INDEX "explore_type_idx" ON "public"."explore"("type");
CREATE INDEX "explore_bumpedAt_idx" ON "public"."explore"("bumpedAt");
ALTER TABLE "public"."explore" ADD CONSTRAINT "explore_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."explore" ADD CONSTRAINT "explore_botApplicationId_fkey" FOREIGN KEY ("botApplicationId") REFERENCES "public"."applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;