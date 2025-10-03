-- DropIndex
DROP INDEX "public"."attachments_messageId_idx";

-- DropIndex
DROP INDEX "public"."bot_commands_applicationId_name_idx";

-- DropIndex
DROP INDEX "public"."messages_channelId_idx";

-- DropIndex
DROP INDEX "public"."post_likes_postId_idx";

-- DropIndex
DROP INDEX "public"."posts_createdAt_commentToId_deleted_idx";

-- DropIndex
DROP INDEX "public"."reacted_message_users_reactionId_idx";

-- DropIndex
DROP INDEX "public"."reply_messages_replyToMessageId_idx";

-- DropIndex
DROP INDEX "public"."schedule_account_content_delete_userId_idx";

-- DropIndex
DROP INDEX "public"."user_devices_userId_ipAddress_idx";
