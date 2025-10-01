import { Channel, Inbox } from '@src/generated/prisma/client';
import { Socket } from 'socket.io';
import { addSocketUser, authenticateUser, getUserPresences } from '../../cache/UserCache';
import { AUTHENTICATED, USER_AUTH_QUEUE_POSITION } from '../../common/ClientEventNames';
import { prisma, publicUserExcludeFields } from '../../common/database';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../../common/Bitwise';
import { removeDuplicates } from '../../common/utils';
import { emitError } from '../../emits/Connection';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';
import { getAllMessageMentions, getLastSeenServerChannelIdsByUserId } from '../../services/Channel';
import { getInbox } from '../../services/Inbox';
import { getServers } from '../../services/Server';
import { onDisconnect } from './onDisconnect';
import { getVoiceUsersByChannelId } from '../../cache/VoiceCache';
import { serverMemberHasPermission } from '../../common/serverMembeHasPermission';
import { LastOnlineStatus } from '../../services/User/User';
import { FriendStatus } from '../../types/Friend';
import { createQueue } from '@nerimity/mimiqueue';
import { redisClient } from '../../common/redis';
import { ReminderSelect } from '../../services/Reminder';
import env from '../../common/env';

const perfMonit = async <T extends Promise<any>>(func: T) => {
  const t1 = performance.now();
  const res = await func;
  const t2 = performance.now();
  return [res, t2 - t1] as const;
};

interface Payload {
  token: string;
  includeCurrentUserServerMembersOnly?: boolean;
}

export const authQueue = createQueue({
  name: 'wsAuth',
  prefix: env.TYPE,
  redisClient,
  minTime: 10,
});

export async function onAuthenticate(socket: Socket, payload: Payload) {
  const queueId = await authQueue.genId();

  let queueEmitPositionIntervalId: NodeJS.Timeout | undefined;

  if (socket.connected) {
    queueEmitPositionIntervalId = setInterval(async () => {
      const pos = await authQueue.getQueuePosition(queueId);
      const actualPos = pos === null ? 0 : pos + 1;
      socket.emit(USER_AUTH_QUEUE_POSITION, { pos: actualPos });
      if (!actualPos) {
        clearInterval(queueEmitPositionIntervalId);
        return;
      }
      if (!socket.connected) {
        clearInterval(queueEmitPositionIntervalId);
      }
    }, 5000);
  }

  authQueue.add(
    async () => {
      clearInterval(queueEmitPositionIntervalId);
      await handleAuthenticate(socket, payload).catch((err) => {
        console.error(err);
      });
    },
    { id: queueId }
  );
}

const handleAuthenticate = async (socket: Socket, payload: Payload) => {
  const ip = (socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address)?.toString();
  if (!socket.connected) {
    return;
  }

  const [[userCache, error], authenticateUserTook] = await perfMonit(authenticateUser(payload.token, ip));

  if (error !== null) {
    emitError(socket, { ...error, disconnect: true });
    return;
  }
  socket.join(userCache.id);

  const [user, userTook] = await perfMonit(
    prisma.user.findUnique({
      where: { id: userCache.id },
      include: {
        reminders: {
          orderBy: { remindAt: 'asc' },
          select: ReminderSelect,
        },
        notificationSettings: {
          select: {
            notificationPingMode: true,
            notificationSoundMode: true,
            serverId: true,
            channelId: true,
            userId: true,
          },
        },
        connections: { select: { id: true, provider: true, connectedAt: true } },
        friends: { include: { recipient: { select: { ...publicUserExcludeFields, lastOnlineStatus: true, lastOnlineAt: true } } } },
        notices: { orderBy: { createdAt: 'asc' }, select: { id: true, type: true, title: true, content: true, createdAt: true, createdBy: { select: { username: true } } } },
        account: {
          select: {
            hideFollowers: true,
            hideFollowing: true,
            email: true,
            serverOrderIds: true,
            serverFolders: { select: { id: true, serverIds: true, color: true, name: true } },
            dmStatus: true,
            friendRequestStatus: true,
            emailConfirmed: true,
          },
        },
      },
    })
  );

  if (!user) {
    emitError(socket, { message: 'User not found.', disconnect: true });
    return;
  }
  const [{ servers, serverChannels, serverMembers, serverRoles }, serversTook] = await perfMonit(getServers(userCache.id, payload.includeCurrentUserServerMembersOnly));

  const [lastSeenServerChannelIds, lastSeenServerChannelIdsTook] = await perfMonit(getLastSeenServerChannelIdsByUserId(userCache.id));

  const [messageMentions, messageMentionsTook] = await perfMonit(getAllMessageMentions(userCache.id));

  const [inbox, inboxTook] = await perfMonit(
    (async () => {
      return !user.bot ? await getInbox(userCache.id) : [];
    })()
  );
  const inboxChannels: Channel[] = [];

  const inboxResponse: Inbox[] = inbox.map((item) => {
    inboxChannels.push(item.channel);
    return { ...item, channel: undefined };
  });

  const friendUserIds = user.friends.map((friend) => friend.recipientId);

  const updatedFriends = user.friends.map((friend) => {
    let isPrivacyFriendsAndServers = [LastOnlineStatus.FRIENDS, LastOnlineStatus.FRIENDS_AND_SERVERS].includes(friend.recipient?.lastOnlineStatus);

    if (friend.status === FriendStatus.BLOCKED) {
      isPrivacyFriendsAndServers = false;
    }

    const { lastOnlineAt, ...user } = friend.recipient;
    const newObj = {
      ...friend,
      recipient: {
        ...user,
        ...(isPrivacyFriendsAndServers ? { lastOnlineAt } : {}),
      },
    };

    return newObj;
  });

  // join room
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i]!;
    socket.join(server.id);

    const member = server.serverMembers.find((member) => member.user.id === userCache.id && member.serverId === server.id);
    if (!member) continue;
    const defaultRole = server.roles.find((role) => role.id === server.defaultRoleId);
    const roleIds = [...member.roleIds, defaultRole!.id];

    const isCreator = server.createdById === userCache.id;

    for (let x = 0; x < server.channels.length; x++) {
      const channel = server.channels[x]!;

      if (isCreator) {
        socket.join(channel.id);
        continue;
      }
      let memberChannelPermissions = 0;

      for (let y = 0; y < channel.permissions.length; y++) {
        const permissions = channel.permissions[y]!;
        if (!roleIds.includes(permissions.roleId)) continue;
        memberChannelPermissions = addBit(memberChannelPermissions, permissions?.permissions || 0);
      }

      const isPublicChannel = hasBit(memberChannelPermissions, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);
      if (isPublicChannel) {
        socket.join(channel.id);
        continue;
      }
      const hasPermission = serverMemberHasPermission({
        permission: ROLE_PERMISSIONS.ADMIN,
        member,
        serverRoles: server.roles,
        defaultRoleId: server.defaultRoleId,
      });
      if (!hasPermission) continue;

      socket.join(channel.id);
    }
    server.serverMembers = undefined;
    server.roles = undefined;
    server.channels = undefined;
  }

  const [isFirstConnect, isFirstConnectTook] = await perfMonit(
    addSocketUser(userCache.id, socket.id, {
      status: user.status,
      custom: user.customStatus! || undefined,
      userId: userCache.id,
    })
  );

  const userIds = removeDuplicates([...serverMembers.map((member) => member.user.id), ...friendUserIds, userCache.id]);

  const [presences, presencesTook] = await perfMonit(getUserPresences(userIds));

  if (isFirstConnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(userCache.id, {
      status: user.status,
      custom: user.customStatus || undefined,
      userId: userCache.id,
    });
  }

  if (!socket.connected) {
    onDisconnect(socket);
    return;
  }

  const channels = [...serverChannels, ...inboxChannels];
  const channelIds = channels.map((channel) => channel.id);

  const [voiceChannelUsers, voiceChannelUsersTook] = await perfMonit(getVoiceUsersByChannelId(channelIds));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { account, ...userCacheWithoutAccount } = userCache;

  socket.emit(AUTHENTICATED, {
    perf: {
      authenticateUserTook,
      userTook,
      serversTook,
      lastSeenServerChannelIdsTook,
      messageMentionsTook,
      inboxTook,
      isFirstConnectTook,
      presencesTook,
      voiceChannelUsersTook,
    },
    user: {
      ...userCacheWithoutAccount,
      hideFollowing: user.account?.hideFollowing,
      hideFollowers: user.account?.hideFollowers,
      email: user.account?.email,
      customStatus: user.customStatus,
      orderedServerIds: user.account?.serverOrderIds,
      serverFolders: user.account?.serverFolders,
      dmStatus: user.account?.dmStatus,
      friendRequestStatus: user.account?.friendRequestStatus,
      lastOnlineStatus: user.lastOnlineStatus,
      emailConfirmed: user.account?.emailConfirmed,
      connections: user.connections,
      notices: user.notices,
      reminders: user.reminders,
    },
    notificationSettings: user.notificationSettings,
    voiceChannelUsers,
    servers,
    serverSettings: [], // Safe to remove. Only here for backwards compatibility.
    serverMembers,
    serverRoles,
    lastSeenServerChannelIds,
    messageMentions,
    presences,
    friends: updatedFriends,
    channels,
    inbox: inboxResponse,
    pid: process.pid,
  });
};
