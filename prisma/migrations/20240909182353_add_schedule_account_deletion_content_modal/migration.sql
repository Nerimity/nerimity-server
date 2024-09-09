-- CreateTable
CREATE TABLE "ScheduleAccountContentDelete" (
    "userId" TEXT NOT NULL,
    "deleteMessages" BOOLEAN NOT NULL DEFAULT false,
    "deletePosts" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAccountContentDelete_userId_key" ON "ScheduleAccountContentDelete"("userId");

-- AddForeignKey
ALTER TABLE "ScheduleAccountContentDelete" ADD CONSTRAINT "ScheduleAccountContentDelete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Add existing users to the schedule table
INSERT INTO "public"."ScheduleAccountContentDelete" ("userId", "deleteMessages", "deletePosts")
SELECT
	"public"."User"."id", true, true
FROM
	"public"."User"
	LEFT JOIN "public"."Application" AS "j1" ON ("j1"."botUserId") = ("public"."User"."id")
	LEFT JOIN "public"."Account" AS "j2" ON ("j2"."userId") = ("public"."User"."id")
WHERE
	(
		("j1"."botUserId" IS NULL)
		AND ("j2"."userId" IS NULL)
	)