-- AlterTable
ALTER TABLE "announcement_posts" RENAME CONSTRAINT "AnnouncementPost_pkey" TO "announcement_posts_pkey";

-- AlterTable
ALTER TABLE "answered_server_welcome_questions" RENAME CONSTRAINT "AnsweredServerWelcomeQuestion_pkey" TO "answered_server_welcome_questions_pkey";

-- AlterTable
ALTER TABLE "attachments" RENAME CONSTRAINT "Attachment_pkey" TO "attachments_pkey";

-- AlterTable
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_pkey" TO "audit_logs_pkey";

-- AlterTable
ALTER TABLE "banned_ips" RENAME CONSTRAINT "BannedIp_pkey" TO "banned_ips_pkey";

-- AlterTable
ALTER TABLE "banned_server_members" RENAME CONSTRAINT "BannedServerMember_pkey" TO "banned_server_members_pkey";

-- AlterTable
ALTER TABLE "bot_commands" RENAME CONSTRAINT "BotCommand_pkey" TO "bot_commands_pkey";

-- AlterTable
ALTER TABLE "channels" RENAME CONSTRAINT "Channel_pkey" TO "channels_pkey";

-- AlterTable
ALTER TABLE "chat_notices" RENAME CONSTRAINT "ChatNotice_pkey" TO "chat_notices_pkey";

-- AlterTable
ALTER TABLE "custom_emojis" RENAME CONSTRAINT "CustomEmoji_pkey" TO "custom_emojis_pkey";

-- AlterTable
ALTER TABLE "external_embeds" RENAME CONSTRAINT "ExternalEmbed_pkey" TO "external_embeds_pkey";

-- AlterTable
ALTER TABLE "followers" RENAME CONSTRAINT "Follower_pkey" TO "followers_pkey";

-- AlterTable
ALTER TABLE "friends" RENAME CONSTRAINT "Friend_pkey" TO "friends_pkey";

-- AlterTable
ALTER TABLE "inboxes" RENAME CONSTRAINT "Inbox_pkey" TO "inboxes_pkey";

-- AlterTable
ALTER TABLE "message_buttons" RENAME CONSTRAINT "MessageButton_pkey" TO "message_buttons_pkey";

-- AlterTable
ALTER TABLE "message_mentions" RENAME CONSTRAINT "MessageMention_pkey" TO "message_mentions_pkey";

-- AlterTable
ALTER TABLE "message_notifications" RENAME CONSTRAINT "MessageNotification_pkey" TO "message_notifications_pkey";

-- AlterTable
ALTER TABLE "message_reactions" RENAME CONSTRAINT "MessageReaction_pkey" TO "message_reactions_pkey";

-- AlterTable
ALTER TABLE "messages" RENAME CONSTRAINT "Message_pkey" TO "messages_pkey";

-- AlterTable
ALTER TABLE "mod_audit_logs" RENAME CONSTRAINT "ModAuditLog_pkey" TO "mod_audit_logs_pkey";

-- AlterTable
ALTER TABLE "pinned_posts" RENAME CONSTRAINT "PinnedPost_pkey" TO "pinned_posts_pkey";

-- AlterTable
ALTER TABLE "post_likes" RENAME CONSTRAINT "PostLike_pkey" TO "post_likes_pkey";

-- AlterTable
ALTER TABLE "post_notifications" RENAME CONSTRAINT "PostNotification_pkey" TO "post_notifications_pkey";

-- AlterTable
ALTER TABLE "post_poll_choices" RENAME CONSTRAINT "PostPollChoice_pkey" TO "post_poll_choices_pkey";

-- AlterTable
ALTER TABLE "post_poll_voted_users" RENAME CONSTRAINT "PostPollVotedUser_pkey" TO "post_poll_voted_users_pkey";

-- AlterTable
ALTER TABLE "post_polls" RENAME CONSTRAINT "PostPoll_pkey" TO "post_polls_pkey";

-- AlterTable
ALTER TABLE "posts" RENAME CONSTRAINT "Post_pkey" TO "posts_pkey";

-- AlterTable
ALTER TABLE "public_servers" RENAME CONSTRAINT "PublicServer_pkey" TO "public_servers_pkey";

-- AlterTable
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_pkey" TO "reminders_pkey";

-- AlterTable
ALTER TABLE "reply_messages" RENAME CONSTRAINT "ReplyMessages_pkey" TO "reply_messages_pkey";

-- AlterTable
ALTER TABLE "schedule_message_delete" RENAME CONSTRAINT "ScheduleMessageDelete_pkey" TO "schedule_message_delete_pkey";

-- AlterTable
ALTER TABLE "server_channel_last_seen" RENAME CONSTRAINT "ServerChannelLastSeen_pkey" TO "server_channel_last_seen_pkey";

-- AlterTable
ALTER TABLE "server_channel_permissions" RENAME CONSTRAINT "ServerChannelPermissions_pkey" TO "server_channel_permissions_pkey";

-- AlterTable
ALTER TABLE "server_invites" RENAME CONSTRAINT "ServerInvite_pkey" TO "server_invites_pkey";

-- AlterTable
ALTER TABLE "server_members" RENAME CONSTRAINT "ServerMember_pkey" TO "server_members_pkey";

-- AlterTable
ALTER TABLE "server_roles" RENAME CONSTRAINT "ServerRole_pkey" TO "server_roles_pkey";

-- AlterTable
ALTER TABLE "server_welcome_answers" RENAME CONSTRAINT "ServerWelcomeAnswer_pkey" TO "server_welcome_answers_pkey";

-- AlterTable
ALTER TABLE "server_welcome_questions" RENAME CONSTRAINT "ServerWelcomeQuestion_pkey" TO "server_welcome_questions_pkey";

-- AlterTable
ALTER TABLE "servers" RENAME CONSTRAINT "Server_pkey" TO "servers_pkey";

-- AlterTable
ALTER TABLE "shadow_bans" RENAME CONSTRAINT "ShadowBan_pkey" TO "shadow_bans_pkey";

-- AlterTable
ALTER TABLE "suspensions" RENAME CONSTRAINT "Suspension_pkey" TO "suspensions_pkey";

-- AlterTable
ALTER TABLE "tickets" RENAME CONSTRAINT "Ticket_pkey" TO "tickets_pkey";

-- AlterTable
ALTER TABLE "user_connections" RENAME CONSTRAINT "UserConnection_pkey" TO "user_connections_pkey";

-- AlterTable
ALTER TABLE "user_devices" RENAME CONSTRAINT "UserDevice_pkey" TO "user_devices_pkey";

-- AlterTable
ALTER TABLE "user_notices" RENAME CONSTRAINT "UserNotice_pkey" TO "user_notices_pkey";

-- AlterTable
ALTER TABLE "user_notification_settings" RENAME CONSTRAINT "UserNotificationSettings_pkey" TO "user_notification_settings_pkey";

-- AlterTable
ALTER TABLE "user_profiles" RENAME CONSTRAINT "UserProfile_pkey" TO "user_profiles_pkey";

-- AlterTable
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";

-- RenameForeignKey
ALTER TABLE "announcement_posts" RENAME CONSTRAINT "AnnouncementPost_postId_fkey" TO "announcement_posts_postId_fkey";

-- RenameForeignKey
ALTER TABLE "answered_server_welcome_questions" RENAME CONSTRAINT "AnsweredServerWelcomeQuestion_answerId_fkey" TO "answered_server_welcome_questions_answerId_fkey";

-- RenameForeignKey
ALTER TABLE "answered_server_welcome_questions" RENAME CONSTRAINT "AnsweredServerWelcomeQuestion_memberId_fkey" TO "answered_server_welcome_questions_memberId_fkey";

-- RenameForeignKey
ALTER TABLE "answered_server_welcome_questions" RENAME CONSTRAINT "AnsweredServerWelcomeQuestion_questionId_fkey" TO "answered_server_welcome_questions_questionId_fkey";

-- RenameForeignKey
ALTER TABLE "attachments" RENAME CONSTRAINT "Attachment_channelId_fkey" TO "attachments_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "attachments" RENAME CONSTRAINT "Attachment_messageId_fkey" TO "attachments_messageId_fkey";

-- RenameForeignKey
ALTER TABLE "attachments" RENAME CONSTRAINT "Attachment_postId_fkey" TO "attachments_postId_fkey";

-- RenameForeignKey
ALTER TABLE "attachments" RENAME CONSTRAINT "Attachment_serverId_fkey" TO "attachments_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "banned_server_members" RENAME CONSTRAINT "BannedServerMember_serverId_fkey" TO "banned_server_members_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "banned_server_members" RENAME CONSTRAINT "BannedServerMember_userId_fkey" TO "banned_server_members_userId_fkey";

-- RenameForeignKey
ALTER TABLE "bot_commands" RENAME CONSTRAINT "BotCommand_applicationId_fkey" TO "bot_commands_applicationId_fkey";

-- RenameForeignKey
ALTER TABLE "bot_commands" RENAME CONSTRAINT "BotCommand_botUserId_fkey" TO "bot_commands_botUserId_fkey";

-- RenameForeignKey
ALTER TABLE "channels" RENAME CONSTRAINT "Channel_categoryId_fkey" TO "channels_categoryId_fkey";

-- RenameForeignKey
ALTER TABLE "channels" RENAME CONSTRAINT "Channel_createdById_fkey" TO "channels_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "channels" RENAME CONSTRAINT "Channel_serverId_fkey" TO "channels_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "chat_notices" RENAME CONSTRAINT "ChatNotice_channelId_fkey" TO "chat_notices_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "chat_notices" RENAME CONSTRAINT "ChatNotice_userId_fkey" TO "chat_notices_userId_fkey";

-- RenameForeignKey
ALTER TABLE "custom_emojis" RENAME CONSTRAINT "CustomEmoji_serverId_fkey" TO "custom_emojis_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "custom_emojis" RENAME CONSTRAINT "CustomEmoji_uploadedById_fkey" TO "custom_emojis_uploadedById_fkey";

-- RenameForeignKey
ALTER TABLE "external_embeds" RENAME CONSTRAINT "ExternalEmbed_serverId_fkey" TO "external_embeds_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "external_embeds" RENAME CONSTRAINT "ExternalEmbed_serverInviteCode_fkey" TO "external_embeds_serverInviteCode_fkey";

-- RenameForeignKey
ALTER TABLE "external_embeds" RENAME CONSTRAINT "ExternalEmbed_userId_fkey" TO "external_embeds_userId_fkey";

-- RenameForeignKey
ALTER TABLE "fcm_tokens" RENAME CONSTRAINT "FirebaseMessagingToken_accountId_fkey" TO "fcm_tokens_accountId_fkey";

-- RenameForeignKey
ALTER TABLE "followers" RENAME CONSTRAINT "Follower_followedById_fkey" TO "followers_followedById_fkey";

-- RenameForeignKey
ALTER TABLE "followers" RENAME CONSTRAINT "Follower_followedToId_fkey" TO "followers_followedToId_fkey";

-- RenameForeignKey
ALTER TABLE "friends" RENAME CONSTRAINT "Friend_recipientId_fkey" TO "friends_recipientId_fkey";

-- RenameForeignKey
ALTER TABLE "friends" RENAME CONSTRAINT "Friend_userId_fkey" TO "friends_userId_fkey";

-- RenameForeignKey
ALTER TABLE "inboxes" RENAME CONSTRAINT "Inbox_channelId_fkey" TO "inboxes_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "inboxes" RENAME CONSTRAINT "Inbox_createdById_fkey" TO "inboxes_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "inboxes" RENAME CONSTRAINT "Inbox_recipientId_fkey" TO "inboxes_recipientId_fkey";

-- RenameForeignKey
ALTER TABLE "message_buttons" RENAME CONSTRAINT "MessageButton_messageId_fkey" TO "message_buttons_messageId_fkey";

-- RenameForeignKey
ALTER TABLE "message_mentions" RENAME CONSTRAINT "MessageMention_channelId_fkey" TO "message_mentions_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "message_mentions" RENAME CONSTRAINT "MessageMention_mentionedById_fkey" TO "message_mentions_mentionedById_fkey";

-- RenameForeignKey
ALTER TABLE "message_mentions" RENAME CONSTRAINT "MessageMention_mentionedToId_fkey" TO "message_mentions_mentionedToId_fkey";

-- RenameForeignKey
ALTER TABLE "message_mentions" RENAME CONSTRAINT "MessageMention_serverId_fkey" TO "message_mentions_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "message_notifications" RENAME CONSTRAINT "MessageNotification_messageId_fkey" TO "message_notifications_messageId_fkey";

-- RenameForeignKey
ALTER TABLE "message_notifications" RENAME CONSTRAINT "MessageNotification_serverId_fkey" TO "message_notifications_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "message_notifications" RENAME CONSTRAINT "MessageNotification_userId_fkey" TO "message_notifications_userId_fkey";

-- RenameForeignKey
ALTER TABLE "message_notifications" RENAME CONSTRAINT "MessageNotification_userId_serverId_fkey" TO "message_notifications_userId_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "message_reactions" RENAME CONSTRAINT "MessageReaction_messageId_fkey" TO "message_reactions_messageId_fkey";

-- RenameForeignKey
ALTER TABLE "messages" RENAME CONSTRAINT "Message_channelId_fkey" TO "messages_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "messages" RENAME CONSTRAINT "Message_createdById_fkey" TO "messages_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "mod_audit_logs" RENAME CONSTRAINT "ModAuditLog_actionById_fkey" TO "mod_audit_logs_actionById_fkey";

-- RenameForeignKey
ALTER TABLE "pinned_posts" RENAME CONSTRAINT "PinnedPost_pinnedById_fkey" TO "pinned_posts_pinnedById_fkey";

-- RenameForeignKey
ALTER TABLE "pinned_posts" RENAME CONSTRAINT "PinnedPost_postId_fkey" TO "pinned_posts_postId_fkey";

-- RenameForeignKey
ALTER TABLE "post_likes" RENAME CONSTRAINT "PostLike_likedById_fkey" TO "post_likes_likedById_fkey";

-- RenameForeignKey
ALTER TABLE "post_likes" RENAME CONSTRAINT "PostLike_postId_fkey" TO "post_likes_postId_fkey";

-- RenameForeignKey
ALTER TABLE "post_notifications" RENAME CONSTRAINT "PostNotification_byId_fkey" TO "post_notifications_byId_fkey";

-- RenameForeignKey
ALTER TABLE "post_notifications" RENAME CONSTRAINT "PostNotification_postId_fkey" TO "post_notifications_postId_fkey";

-- RenameForeignKey
ALTER TABLE "post_notifications" RENAME CONSTRAINT "PostNotification_toId_fkey" TO "post_notifications_toId_fkey";

-- RenameForeignKey
ALTER TABLE "post_poll_choices" RENAME CONSTRAINT "PostPollChoice_pollId_fkey" TO "post_poll_choices_pollId_fkey";

-- RenameForeignKey
ALTER TABLE "post_poll_voted_users" RENAME CONSTRAINT "PostPollVotedUser_pollChoiceId_fkey" TO "post_poll_voted_users_pollChoiceId_fkey";

-- RenameForeignKey
ALTER TABLE "post_poll_voted_users" RENAME CONSTRAINT "PostPollVotedUser_pollId_fkey" TO "post_poll_voted_users_pollId_fkey";

-- RenameForeignKey
ALTER TABLE "post_poll_voted_users" RENAME CONSTRAINT "PostPollVotedUser_userId_fkey" TO "post_poll_voted_users_userId_fkey";

-- RenameForeignKey
ALTER TABLE "post_polls" RENAME CONSTRAINT "PostPoll_postId_fkey" TO "post_polls_postId_fkey";

-- RenameForeignKey
ALTER TABLE "posts" RENAME CONSTRAINT "Post_commentToId_fkey" TO "posts_commentToId_fkey";

-- RenameForeignKey
ALTER TABLE "posts" RENAME CONSTRAINT "Post_createdById_fkey" TO "posts_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "posts" RENAME CONSTRAINT "Post_quotedPostId_fkey" TO "posts_quotedPostId_fkey";

-- RenameForeignKey
ALTER TABLE "posts" RENAME CONSTRAINT "Post_repostId_fkey" TO "posts_repostId_fkey";

-- RenameForeignKey
ALTER TABLE "public_servers" RENAME CONSTRAINT "PublicServer_serverId_fkey" TO "public_servers_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "reacted_message_users" RENAME CONSTRAINT "ReactedMessageUser_reactionId_fkey" TO "reacted_message_users_reactionId_fkey";

-- RenameForeignKey
ALTER TABLE "reacted_message_users" RENAME CONSTRAINT "ReactedMessageUser_userId_fkey" TO "reacted_message_users_userId_fkey";

-- RenameForeignKey
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_channelId_fkey" TO "reminders_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_createdById_fkey" TO "reminders_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_messageId_fkey" TO "reminders_messageId_fkey";

-- RenameForeignKey
ALTER TABLE "reminders" RENAME CONSTRAINT "Reminder_postId_fkey" TO "reminders_postId_fkey";

-- RenameForeignKey
ALTER TABLE "reply_messages" RENAME CONSTRAINT "ReplyMessages_messageId_fkey" TO "reply_messages_messageId_fkey";

-- RenameForeignKey
ALTER TABLE "reply_messages" RENAME CONSTRAINT "ReplyMessages_replyToMessageId_fkey" TO "reply_messages_replyToMessageId_fkey";

-- RenameForeignKey
ALTER TABLE "schedule_account_content_delete" RENAME CONSTRAINT "ScheduleAccountContentDelete_userId_fkey" TO "schedule_account_content_delete_userId_fkey";

-- RenameForeignKey
ALTER TABLE "schedule_server_delete" RENAME CONSTRAINT "ScheduleServerDelete_scheduledByUserId_fkey" TO "schedule_server_delete_scheduledByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "schedule_server_delete" RENAME CONSTRAINT "ScheduleServerDelete_serverId_fkey" TO "schedule_server_delete_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "server_channel_last_seen" RENAME CONSTRAINT "ServerChannelLastSeen_channelId_fkey" TO "server_channel_last_seen_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "server_channel_last_seen" RENAME CONSTRAINT "ServerChannelLastSeen_serverId_fkey" TO "server_channel_last_seen_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "server_channel_last_seen" RENAME CONSTRAINT "ServerChannelLastSeen_userId_fkey" TO "server_channel_last_seen_userId_fkey";

-- RenameForeignKey
ALTER TABLE "server_channel_permissions" RENAME CONSTRAINT "ServerChannelPermissions_channelId_fkey" TO "server_channel_permissions_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "server_channel_permissions" RENAME CONSTRAINT "ServerChannelPermissions_roleId_fkey" TO "server_channel_permissions_roleId_fkey";

-- RenameForeignKey
ALTER TABLE "server_channel_permissions" RENAME CONSTRAINT "ServerChannelPermissions_serverId_fkey" TO "server_channel_permissions_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "server_invites" RENAME CONSTRAINT "ServerInvite_createdById_fkey" TO "server_invites_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "server_invites" RENAME CONSTRAINT "ServerInvite_serverId_fkey" TO "server_invites_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "server_members" RENAME CONSTRAINT "ServerMember_serverId_fkey" TO "server_members_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "server_members" RENAME CONSTRAINT "ServerMember_userId_fkey" TO "server_members_userId_fkey";

-- RenameForeignKey
ALTER TABLE "server_roles" RENAME CONSTRAINT "ServerRole_createdById_fkey" TO "server_roles_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "server_roles" RENAME CONSTRAINT "ServerRole_serverId_fkey" TO "server_roles_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "server_welcome_answers" RENAME CONSTRAINT "ServerWelcomeAnswer_questionId_fkey" TO "server_welcome_answers_questionId_fkey";

-- RenameForeignKey
ALTER TABLE "server_welcome_questions" RENAME CONSTRAINT "ServerWelcomeQuestion_serverId_fkey" TO "server_welcome_questions_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "servers" RENAME CONSTRAINT "Server_createdById_fkey" TO "servers_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "servers" RENAME CONSTRAINT "Server_systemChannelId_fkey" TO "servers_systemChannelId_fkey";

-- RenameForeignKey
ALTER TABLE "shadow_bans" RENAME CONSTRAINT "ShadowBan_bannedById_fkey" TO "shadow_bans_bannedById_fkey";

-- RenameForeignKey
ALTER TABLE "shadow_bans" RENAME CONSTRAINT "ShadowBan_userId_fkey" TO "shadow_bans_userId_fkey";

-- RenameForeignKey
ALTER TABLE "suspensions" RENAME CONSTRAINT "Suspension_suspendedById_fkey" TO "suspensions_suspendedById_fkey";

-- RenameForeignKey
ALTER TABLE "suspensions" RENAME CONSTRAINT "Suspension_userId_fkey" TO "suspensions_userId_fkey";

-- RenameForeignKey
ALTER TABLE "tickets" RENAME CONSTRAINT "Ticket_channelId_fkey" TO "tickets_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "tickets" RENAME CONSTRAINT "Ticket_openedById_fkey" TO "tickets_openedById_fkey";

-- RenameForeignKey
ALTER TABLE "user_connections" RENAME CONSTRAINT "UserConnection_userId_fkey" TO "user_connections_userId_fkey";

-- RenameForeignKey
ALTER TABLE "user_devices" RENAME CONSTRAINT "UserDevice_userId_fkey" TO "user_devices_userId_fkey";

-- RenameForeignKey
ALTER TABLE "user_notices" RENAME CONSTRAINT "UserNotice_createdById_fkey" TO "user_notices_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "user_notices" RENAME CONSTRAINT "UserNotice_userId_fkey" TO "user_notices_userId_fkey";

-- RenameForeignKey
ALTER TABLE "user_notification_settings" RENAME CONSTRAINT "UserNotificationSettings_channelId_fkey" TO "user_notification_settings_channelId_fkey";

-- RenameForeignKey
ALTER TABLE "user_notification_settings" RENAME CONSTRAINT "UserNotificationSettings_serverId_fkey" TO "user_notification_settings_serverId_fkey";

-- RenameForeignKey
ALTER TABLE "user_notification_settings" RENAME CONSTRAINT "UserNotificationSettings_userId_fkey" TO "user_notification_settings_userId_fkey";

-- RenameForeignKey
ALTER TABLE "user_profiles" RENAME CONSTRAINT "UserProfile_userId_fkey" TO "user_profiles_userId_fkey";

-- RenameIndex
ALTER INDEX "AnsweredServerWelcomeQuestion_memberId_answerId_key" RENAME TO "answered_server_welcome_questions_memberId_answerId_key";

-- RenameIndex
ALTER INDEX "Attachment_messageId_createdAt_idx" RENAME TO "attachments_messageId_createdAt_idx";

-- RenameIndex
ALTER INDEX "AuditLog_actionById_createdAt_idx" RENAME TO "audit_logs_actionById_createdAt_idx";

-- RenameIndex
ALTER INDEX "AuditLog_serverId_createdAt_idx" RENAME TO "audit_logs_serverId_createdAt_idx";

-- RenameIndex
ALTER INDEX "BannedIp_ipAddress_key" RENAME TO "banned_ips_ipAddress_key";

-- RenameIndex
ALTER INDEX "BotCommand_applicationId_name_idx" RENAME TO "bot_commands_applicationId_name_idx";

-- RenameIndex
ALTER INDEX "BotCommand_applicationId_name_key" RENAME TO "bot_commands_applicationId_name_key";

-- RenameIndex
ALTER INDEX "BotCommand_botUserId_name_idx" RENAME TO "bot_commands_botUserId_name_idx";

-- RenameIndex
ALTER INDEX "ChatNotice_channelId_key" RENAME TO "chat_notices_channelId_key";

-- RenameIndex
ALTER INDEX "ChatNotice_userId_key" RENAME TO "chat_notices_userId_key";

-- RenameIndex
ALTER INDEX "ExternalEmbed_serverId_key" RENAME TO "external_embeds_serverId_key";

-- RenameIndex
ALTER INDEX "ExternalEmbed_serverInviteCode_key" RENAME TO "external_embeds_serverInviteCode_key";

-- RenameIndex
ALTER INDEX "ExternalEmbed_userId_key" RENAME TO "external_embeds_userId_key";

-- RenameIndex
ALTER INDEX "FirebaseMessagingToken_token_key" RENAME TO "fcm_tokens_token_key";

-- RenameIndex
ALTER INDEX "Follower_followedById_followedToId_key" RENAME TO "followers_followedById_followedToId_key";

-- RenameIndex
ALTER INDEX "Friend_userId_recipientId_key" RENAME TO "friends_userId_recipientId_key";

-- RenameIndex
ALTER INDEX "Inbox_createdById_channelId_key" RENAME TO "inboxes_createdById_channelId_key";

-- RenameIndex
ALTER INDEX "MessageMention_mentionedById_mentionedToId_channelId_key" RENAME TO "message_mentions_mentionedById_mentionedToId_channelId_key";

-- RenameIndex
ALTER INDEX "MessageNotification_messageId_createdAt_idx" RENAME TO "message_notifications_messageId_createdAt_idx";

-- RenameIndex
ALTER INDEX "MessageReaction_messageId_idx" RENAME TO "message_reactions_messageId_idx";

-- RenameIndex
ALTER INDEX "Message_channelId_createdAt_idx" RENAME TO "messages_channelId_createdAt_idx";

-- RenameIndex
ALTER INDEX "Message_channelId_idx" RENAME TO "messages_channelId_idx";

-- RenameIndex
ALTER INDEX "Message_createdById_idx" RENAME TO "messages_createdById_idx";

-- RenameIndex
ALTER INDEX "PostLike_postId_likedById_key" RENAME TO "post_likes_postId_likedById_key";

-- RenameIndex
ALTER INDEX "PostPoll_postId_key" RENAME TO "post_polls_postId_key";

-- RenameIndex
ALTER INDEX "Post_createdById_createdAt_idx" RENAME TO "posts_createdById_createdAt_idx";

-- RenameIndex
ALTER INDEX "PublicServer_serverId_key" RENAME TO "public_servers_serverId_key";

-- RenameIndex
ALTER INDEX "ReactedMessageUser_reactionId_userId_key" RENAME TO "reacted_message_users_reactionId_userId_key";

-- RenameIndex
ALTER INDEX "ReplyMessages_messageId_replyToMessageId_key" RENAME TO "reply_messages_messageId_replyToMessageId_key";

-- RenameIndex
ALTER INDEX "ReplyMessages_replyToMessageId_messageId_idx" RENAME TO "reply_messages_replyToMessageId_messageId_idx";

-- RenameIndex
ALTER INDEX "ScheduleAccountContentDelete_userId_idx" RENAME TO "schedule_account_content_delete_userId_idx";

-- RenameIndex
ALTER INDEX "ScheduleAccountContentDelete_userId_key" RENAME TO "schedule_account_content_delete_userId_key";

-- RenameIndex
ALTER INDEX "ScheduleAccountContentDelete_userId_scheduledAt_idx" RENAME TO "schedule_account_content_delete_userId_scheduledAt_idx";

-- RenameIndex
ALTER INDEX "ScheduleServerDelete_serverId_key" RENAME TO "schedule_server_delete_serverId_key";

-- RenameIndex
ALTER INDEX "ServerChannelLastSeen_channelId_userId_serverId_key" RENAME TO "server_channel_last_seen_channelId_userId_serverId_key";

-- RenameIndex
ALTER INDEX "ServerInvite_code_key" RENAME TO "server_invites_code_key";

-- RenameIndex
ALTER INDEX "ServerMember_userId_serverId_key" RENAME TO "server_members_userId_serverId_key";

-- RenameIndex
ALTER INDEX "Server_systemChannelId_key" RENAME TO "servers_systemChannelId_key";

-- RenameIndex
ALTER INDEX "ShadowBan_userId_key" RENAME TO "shadow_bans_userId_key";

-- RenameIndex
ALTER INDEX "Suspension_userId_key" RENAME TO "suspensions_userId_key";

-- RenameIndex
ALTER INDEX "Ticket_channelId_key" RENAME TO "tickets_channelId_key";

-- RenameIndex
ALTER INDEX "UserDevice_userId_ipAddress_idx" RENAME TO "user_devices_userId_ipAddress_idx";

-- RenameIndex
ALTER INDEX "UserDevice_userId_ipAddress_key" RENAME TO "user_devices_userId_ipAddress_key";

-- RenameIndex
ALTER INDEX "UserNotificationSettings_userId_channelId_key" RENAME TO "user_notification_settings_userId_channelId_key";

-- RenameIndex
ALTER INDEX "UserNotificationSettings_userId_serverId_key" RENAME TO "user_notification_settings_userId_serverId_key";

-- RenameIndex
ALTER INDEX "User_username_tag_key" RENAME TO "users_username_tag_key";
