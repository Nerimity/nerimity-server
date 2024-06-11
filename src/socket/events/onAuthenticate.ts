import { Channel, Inbox } from '@prisma/client';
import { Socket } from 'socket.io';
import { addSocketUser, authenticateUser, getUserPresences } from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
import { prisma, publicUserExcludeFields } from '../../common/database';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, hasBit } from '../../common/Bitwise';
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

interface Payload {
  token: string;
}

export async function onAuthenticate(socket: Socket, payload: Payload) {
  const ip = (socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address)?.toString();

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
      serverFolders: { select: { id: true, icon: true, serverIds: true, name: true } },
      connections: { select: { id: true, provider: true, connectedAt: true } },
      friends: { include: { recipient: { select: publicUserExcludeFields } } },
      notices: { orderBy: { createdAt: 'asc' }, select: { id: true, type: true, title: true, content: true, createdAt: true, createdBy: { select: { username: true } } } },
      account: {
        select: {
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

  // join room
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i]!;
    socket.join(server.id);
  }

  for (let i = 0; i < serverChannels.length; i++) {
    const channel = serverChannels[i]!;

    const server = servers.find((server) => server.id === channel.serverId);
    if (!server) throw new Error(`Server not found (channelId: ${channel.id} serverId: ${channel.serverId})`);

    const isCreator = server.createdById === userCache.id;
    if (isCreator) {
      socket.join(channel.id);
      continue;
    }

    const isPrivateChannel = hasBit(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);

    if (!isPrivateChannel) {
      socket.join(channel.id);
      continue;
    }

    const hasPermission = serverMemberHasPermission({
      permission: ROLE_PERMISSIONS.ADMIN,
      member: serverMembers.find((member) => member.user.id === userCache.id && member.serverId === server.id)!,
      serverRoles: serverRoles,
      defaultRoleId: server.defaultRoleId,
    });
    if (!hasPermission) continue;

    socket.join(channel.id);
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
      email: user.account?.email,
      customStatus: user.customStatus,
      orderedServerIds: user.account?.serverOrderIds,
      dmStatus: user.account?.dmStatus,
      friendRequestStatus: user.account?.friendRequestStatus,
      emailConfirmed: user.account?.emailConfirmed,
      connections: user.connections,
      notices: user.notices,
    },
    notificationSettings: user.notificationSettings,
    voiceChannelUsers,
    serverFolders: user.serverFolders,
    servers,
    serverSettings: [], // Safe to remove. Only here for backwards compatibility.
    serverMembers,
    serverRoles,
    lastSeenServerChannelIds,
    messageMentions,
    presences,
    friends: user.friends,
    channels,
    inbox: inboxResponse,
  });
}
