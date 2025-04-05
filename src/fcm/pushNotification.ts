import admin from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import { prisma } from '../common/database';
import { NotificationPingMode, removeFCMTokens } from '../services/User/User';
import { Message, ServerChannelPermissions, ServerRole, User } from '@prisma/client';
import { ChannelCache } from '../cache/ChannelCache';
import { ServerCache } from '../cache/ServerCache';
import { Log } from '../common/Log';
import { addBit, CHANNEL_PERMISSIONS, hasBit, ROLE_PERMISSIONS } from '../common/Bitwise';
import { serverMemberHasPermission } from '../common/serverMembeHasPermission';

let credentials: any;
try {
  credentials = require('../fcm-credentials.json');
} catch {
  Log.warn('fcm-credentials.json was not provided. Mobile push notifications will not work.');
}

if (credentials) {
  admin.initializeApp({
    credential: cert(credentials),
  });
}

export async function sendServerPushMessageNotification(
  serverId: string,
  message: Message & {
    createdBy: {
      id: string;
      username: string;
      avatar?: string | null;
      hexColor: string | null;
    };
    mentions: {
      id: string;
      username: string;
      tag: string;
      hexColor: string | null;
      avatar: string | null;
    }[];
  },
  channel: ChannelCache,
  server: ServerCache
) {
  // if (message.silent) return;
  // if (!credentials) return;

  const channelPermissions = await prisma.serverChannelPermissions.findMany({
    where: { channelId: message.channelId, serverId },
  });

  const defaultChannelPermission = channelPermissions.find((cp) => cp.roleId === server.defaultRoleId);
  const isPrivateChannel = !hasBit(defaultChannelPermission?.permissions || 0, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);

  const roles = isPrivateChannel ? await prisma.serverRole.findMany({ where: { serverId } }) : [];

  const mentionedUserIds = message.mentions.map((user) => user.id);

  const users = await prisma.firebaseMessagingToken.findMany({
    where: {
      account: {
        user: {
          servers: {
            some: {
              id: serverId,
            },
          },
        },
      },
    },
    select: {
      token: true,
      account: {
        select: {
          user: {
            select: {
              ...(isPrivateChannel
                ? {
                    memberInServers: {
                      where: { serverId },
                      select: { roleIds: true },
                    },
                  }
                : {}),
              id: true,
              notificationSettings: {
                where: {
                  OR: [{ channelId: channel.id }, { serverId }],
                },
                select: { channelId: true, serverId: true, notificationPingMode: true },
              },
            },
          },
        },
      },
    },
  });

  const filteredUsers = users.filter((fmt) => {
    const user = fmt.account.user;

    if (
      isPrivateChannel &&
      !hasChannelPermission({
        server,
        roles: roles,
        user: user,
        member: user.memberInServers[0] || { roleIds: [] },
        permissions: channelPermissions,
      })
    )
      return false;

    if (!user.notificationSettings.length) return true;
    const channelNotificationMode = user.notificationSettings.find((n) => n.channelId)?.notificationPingMode;
    const serverNotificationMode = user.notificationSettings.find((n) => n.serverId)?.notificationPingMode;

    const combined = channelNotificationMode ?? serverNotificationMode;
    if (combined === null || combined === undefined) return true;

    if (combined === NotificationPingMode.MENTIONS_ONLY) {
      return mentionedUserIds.includes(user.id);
    }

    return combined === NotificationPingMode.ALL;
  });

  const tokens = filteredUsers.map((fcm) => fcm.token);

  if (!tokens.length) return;

  let content = message.content as string | undefined;

  if (content) {
    content = formatMessage(message as any)!;
    content = content.substring(0, 100);
  }

  const batchResponse = await admin.messaging().sendEachForMulticast({
    tokens,
    android: { priority: 'high' },
    data: {
      ...(content ? { content } : undefined),
      type: message.type.toString(),
      channelName: channel.name!,
      serverName: server.name,
      channelId: message.channelId,
      serverId,
      cUserId: message.createdBy.id,
      cName: message.createdBy.username,
      ...(server.avatar ? { sAvatar: server.avatar } : undefined),
      ...(server.hexColor ? { sHexColor: server.hexColor } : undefined),
    },
  });

  const failedTokens = batchResponse.responses.map((sendResponse, index) => sendResponse.error && tokens[index]).filter((token) => token) as string[];

  if (!failedTokens.length) return;
  removeFCMTokens(failedTokens);
}

export async function sendDmPushNotification(
  message: Message & {
    createdBy: {
      id: string;
      username: string;
      avatar?: string | null;
      hexColor: string | null;
    };
  },
  channel: ChannelCache
) {
  if (message.silent) return;
  if (!credentials) return;
  const recipientId = channel.inbox?.recipientId;
  const tokens = (
    await prisma.firebaseMessagingToken.findMany({
      where: { account: { user: { id: recipientId } } },
      select: { token: true },
    })
  ).map((fcm) => fcm.token);
  if (!tokens.length) return;

  let content = message.content as string | undefined;

  if (content) {
    content = formatMessage(message as any)!;
    content = content.substring(0, 100);
  }
  const batchResponse = await admin.messaging().sendEachForMulticast({
    tokens,
    android: { priority: 'high' },
    data: {
      ...(content ? { content } : undefined),
      type: message.type.toString(),
      channelId: message.channelId,
      cUserId: message.createdBy.id,
      cName: message.createdBy.username,
      ...(message.createdBy.avatar ? { uAvatar: message.createdBy.avatar } : undefined),
      ...(message.createdBy.hexColor ? { uHexColor: message.createdBy.hexColor } : undefined),
    },
  });

  const failedTokens = batchResponse.responses.map((sendResponse, index) => sendResponse.error && tokens[index]).filter((token) => token) as string[];

  if (!failedTokens.length) return;
  removeFCMTokens(failedTokens);
}

interface hasChannelPermissionOpts {
  server: ServerCache;
  roles: ServerRole[];
  user: { id: string };
  member: { roleIds: string[] };
  permissions: ServerChannelPermissions[];
}
function hasChannelPermission(opts: hasChannelPermissionOpts) {
  const isServerCreator = opts.server.createdById === opts.user.id;
  if (isServerCreator) return true;

  const isAdmin = serverMemberHasPermission({
    permission: ROLE_PERMISSIONS.ADMIN,
    member: opts.member,
    serverRoles: opts.roles,
    defaultRoleId: opts.server.defaultRoleId,
  });
  if (isAdmin) return true;

  let totalPermissions = 0;
  for (let i = 0; i < opts.permissions.length; i++) {
    const permission = opts.permissions[i]!;
    if (!opts.member.roleIds.includes(permission.roleId)) continue;
    totalPermissions = addBit(totalPermissions, permission.permissions || 0);
  }
  return hasBit(totalPermissions, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);
}

const UserMentionRegex = /\[@:(.*?)\]/g;
const RoleMentionRegex = /\[r:(.*?)\]/g;
const CustomEmojiRegex = /\[[a]?ce:(.*?):(.*?)\]/g;
const commandRegex = /^(\/[^:\s]*):\d+( .*)?$/m;

function formatMessage(message: { mentions: User[]; content?: string; roleMentions: ServerRole[] }) {
  const content = message.content;
  if (!content) return;

  const mentionReplace = content.replace(UserMentionRegex, (_, id) => {
    const user = message.mentions?.find((m) => m.id === id);
    return user ? `@${user.username}` : _;
  });

  const roleReplace = mentionReplace.replace(RoleMentionRegex, (_, id) => {
    const role = message.roleMentions?.find((m) => m.id === id);
    return role ? `@${role.name}` : _;
  });

  const cEmojiReplace = roleReplace.replace(CustomEmojiRegex, (_, __, p2) => {
    return `:${p2}:`;
  });

  const commandReplace = cEmojiReplace.replace(commandRegex, '$1$2');

  return commandReplace;
}
