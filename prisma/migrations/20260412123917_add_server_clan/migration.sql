-- CreateTable
CREATE TABLE "server_member_clans" (
    "serverMemberId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "server_member_clans_pkey" PRIMARY KEY ("serverMemberId")
);

-- CreateTable
CREATE TABLE "server_clans" (
    "serverId" TEXT NOT NULL,
    "tag" CHAR(4) NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "server_clans_pkey" PRIMARY KEY ("serverId")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_member_clans_userId_key" ON "server_member_clans"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "server_member_clans_serverMemberId_serverId_userId_key" ON "server_member_clans"("serverMemberId", "serverId", "userId");

-- AddForeignKey
ALTER TABLE "server_member_clans" ADD CONSTRAINT "server_member_clans_serverMemberId_fkey" FOREIGN KEY ("serverMemberId") REFERENCES "server_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_member_clans" ADD CONSTRAINT "server_member_clans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_member_clans" ADD CONSTRAINT "server_member_clans_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server_clans"("serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_clans" ADD CONSTRAINT "server_clans_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
