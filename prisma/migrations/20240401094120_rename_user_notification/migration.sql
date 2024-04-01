

ALTER TABLE "UserNotification" RENAME TO "MessageNotification";




ALTER TABLE "MessageNotification" RENAME CONSTRAINT "UserNotification_messageId_fkey" to "MessageNotification_messageId_fkey";


ALTER TABLE "MessageNotification" RENAME CONSTRAINT "UserNotification_serverId_fkey" to "MessageNotification_serverId_fkey";


ALTER TABLE "MessageNotification" RENAME CONSTRAINT "UserNotification_userId_fkey" to "MessageNotification_userId_fkey";


ALTER TABLE "MessageNotification" RENAME CONSTRAINT "UserNotification_userId_serverId_fkey" to "MessageNotification_userId_serverId_fkey";

