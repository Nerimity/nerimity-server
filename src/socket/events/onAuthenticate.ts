import { Channel, Inbox } from '@prisma/client';
import { Socket } from 'socket.io';
import { addSocketUser, authenticateUser, getUserPresences } from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
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
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 333,
});

interface Payload {
  token: string;
}

export const authQueue = createQueue({
  name: 'wsAuth',
  redisClient,
  minTime: 100,
});

export async function onAuthenticate(socket: Socket, payload: Payload) {
  limiter.schedule(async () => {
    const ip = (socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address)?.toString();

    authQueue.add(
      async () => {
        await handleAuthenticate(socket, payload).catch((err) => {
          console.error(err);
        });
      },
      { groupName: ip }
    );
  });
}

const handleAuthenticate = async (socket: Socket, payload: Payload) => {
  const ip = (socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address)?.toString();
  if (!socket.connected) {
    return;
  }

  const [userCache, error] = await authenticateUser(payload.token, ip);

  if (error !== null) {
    emitError(socket, { ...error, disconnect: true });
    return;
  }
  socket.join(userCache.id);

  const user = await prisma.user.findUnique({
    where: { id: userCache.id },
    include: {
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
          dmStatus: true,
          friendRequestStatus: true,
          emailConfirmed: true,
        },
      },
    },
  });

  if (!user) {
    emitError(socket, { message: 'User not found.', disconnect: true });
    return;
  }
  const { servers, serverChannels, serverMembers, serverRoles } = await getServers(userCache.id);

  const lastSeenServerChannelIds = await getLastSeenServerChannelIdsByUserId(userCache.id);

  const messageMentions = await getAllMessageMentions(userCache.id);

  const inbox = await getInbox(userCache.id);
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
    member.roleIds.push(defaultRole!.id);

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
        if (!member.roleIds.includes(permissions.roleId)) continue;
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
    delete server.serverMembers;
    delete server.roles;
    delete server.channels;
  }

  const isFirstConnect = await addSocketUser(userCache.id, socket.id, {
    status: user.status,
    custom: user.customStatus! || undefined,
    userId: userCache.id,
  });

  const userIds = removeDuplicates([...serverMembers.map((member) => member.user.id), ...friendUserIds, userCache.id]);

  const presences = await getUserPresences(userIds);

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

  const voiceChannelUsers = await getVoiceUsersByChannelId(channelIds);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { account, ...userCacheWithoutAccount } = userCache;

  socket.emit(AUTHENTICATED, {
    user: {
      ...userCacheWithoutAccount,
      hideFollowing: user.account?.hideFollowing,
      hideFollowers: user.account?.hideFollowers,
      email: user.account?.email,
      customStatus: user.customStatus,
      orderedServerIds: user.account?.serverOrderIds,
      dmStatus: user.account?.dmStatus,
      friendRequestStatus: user.account?.friendRequestStatus,
      lastOnlineStatus: user.lastOnlineStatus,
      emailConfirmed: user.account?.emailConfirmed,
      connections: user.connections,
      notices: user.notices,
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
