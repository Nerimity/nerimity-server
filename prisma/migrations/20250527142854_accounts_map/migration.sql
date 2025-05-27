
ALTER TABLE "Account" RENAME TO "accounts";

ALTER TABLE "accounts" RENAME CONSTRAINT "Account_pkey" TO "accounts_pkey";

ALTER TABLE "accounts" RENAME CONSTRAINT "Account_userId_fkey" TO "accounts_userId_fkey";