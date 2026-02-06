/*
  Warnings:

  - The primary key for the `server_channel_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `id` to the `server_channel_permissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "server_channel_permissions" DROP CONSTRAINT "server_channel_permissions_pkey",
ADD COLUMN     "id" TEXT,
ALTER COLUMN "roleId" DROP NOT NULL;

-- Backfill id from roleId; resolve duplicates by incrementing the snowflake
WITH ranked AS (
  SELECT
    "roleId",
    "channelId",
    ROW_NUMBER() OVER (PARTITION BY "roleId" ORDER BY "channelId") AS rn
  FROM "server_channel_permissions"
  WHERE "roleId" IS NOT NULL
)
UPDATE "server_channel_permissions" scp
SET "id" = (ranked."roleId"::bigint + ranked.rn - 1)::text
FROM ranked
WHERE scp."roleId" = ranked."roleId"
  AND scp."channelId" = ranked."channelId";

-- Enforce id constraints after backfill
ALTER TABLE "server_channel_permissions"
ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "server_channel_permissions_pkey" PRIMARY KEY ("id");
