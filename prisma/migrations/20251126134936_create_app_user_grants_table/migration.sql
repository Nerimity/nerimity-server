-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "clientSecret" TEXT,
ADD COLUMN     "redirectUris" TEXT[];

-- CreateTable
CREATE TABLE "application_user_grants" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshToken" TEXT,
    "refreshExpiresAt" TIMESTAMP(3),
    "accessToken" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "scopes" INTEGER NOT NULL,
    "redirectUri" TEXT NOT NULL,

    CONSTRAINT "application_user_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_user_grants_code_key" ON "application_user_grants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "application_user_grants_refreshToken_key" ON "application_user_grants"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "application_user_grants_accessToken_key" ON "application_user_grants"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "application_user_grants_applicationId_userId_key" ON "application_user_grants"("applicationId", "userId");

-- AddForeignKey
ALTER TABLE "application_user_grants" ADD CONSTRAINT "application_user_grants_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_user_grants" ADD CONSTRAINT "application_user_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
