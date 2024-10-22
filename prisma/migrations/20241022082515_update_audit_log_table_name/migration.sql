ALTER TABLE "AuditLog" RENAME TO "ModAuditLog";


ALTER TABLE "ModAuditLog" RENAME CONSTRAINT "AuditLog_actionById_fkey" to "ModAuditLog_actionById_fkey";
ALTER TABLE "ModAuditLog" RENAME CONSTRAINT "AuditLog_pkey" to "ModAuditLog_pkey";


