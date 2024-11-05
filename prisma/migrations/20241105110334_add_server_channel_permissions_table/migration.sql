/*
  Warnings:

  - You are about to drop the column `permissions` on the `Channel` table. All the data in the column will be lost.

*/

-- CreateTable
CREATE TABLE "ServerChannelPermissions" (
    "permissions" INTEGER,
    "roleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerChannelPermissions_pkey" PRIMARY KEY ("roleId","channelId")
);

-- AddForeignKey
ALTER TABLE "ServerChannelPermissions" ADD CONSTRAINT "ServerChannelPermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ServerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerChannelPermissions" ADD CONSTRAINT "ServerChannelPermissions_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerChannelPermissions" ADD CONSTRAINT "ServerChannelPermissions_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Add existing
INSERT INTO
	"public"."ServerChannelPermissions" ("permissions", "roleId", "channelId", "serverId")
SELECT
	"Channel"."permissions",
	"Server"."defaultRoleId",
	"Channel"."id",
	"Server"."id"
FROM
	"Channel"
	LEFT JOIN "Server" ON ("Server"."id") = ("Channel"."serverId")
WHERE
	"Channel"."serverId" IS NOT NULL;


-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "permissions";
