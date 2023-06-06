import { Channel, Inbox } from '@prisma/client';
import { Socket } from 'socket.io';
import {
  addSocketUser,
  authenticateUser,
  getUserPresences,
} from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
import { prisma } from '../../common/database';
import { CHANNEL_PERMISSIONS, hasBit } from '../../common/Bitwise';
import { removeDuplicates } from '../../common/utils';
import { emitError } from '../../emits/Connection';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';
import {
  getAllMessageMentions,
  getLastSeenServerChannelIdsByUserId,
} from '../../services/Channel';
import { getInbox } from '../../services/Inbox';
import { getServers } from '../../services/Server';
import { onDisconnect } from './onDisconnect';

interface Payload {
  token: string;
}

export async function onAuthenticate(socket: Socket, payload: Payload) {
  const [accountCache, error] = await authenticateUser(payload.token);

  if (error !== null) {
    emitError(socket, { ...error, disconnect: true });
    return;
  }
  const cacheUser = accountCache.user;
  socket.join(accountCache.user.id);

  const user = await prisma.user.findFirst({
    where: { id: accountCache.user.id },
    include: {
      friends: { include: { recipient: true } },
      account: { select: { email: true, serverOrderIds: true } },
    },
  });

  if (!user) {
    emitError(socket, { message: 'User not found.', disconnect: true });
    return;
  }
  const { servers, serverChannels, serverMembers, serverRoles } =
    await getServers(cacheUser.id);

  const lastSeenServerChannelIds = await getLastSeenServerChannelIdsByUserId(
    cacheUser.id
  );

  const messageMentions = await getAllMessageMentions(cacheUser.id);

  const inbox = await getInbox(cacheUser.id);
  const inboxChannels: Channel[] = [];

  const inboxResponse: Inbox[] = inbox.map((item) => {
    inboxChannels.push(item.channel);
    return { ...item, channel: undefined };
  });

  const friendUserIds = user.friends.map((friend) => friend.recipientId);

  // join room
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    socket.join(server.id);
  }

  for (let i = 0; i < serverChannels.length; i++) {
    const channel = serverChannels[i];

    const server = servers.find((server) => server.id === channel.serverId);
    if (!server)
      throw new Error(
        `Server not found (channelId: ${channel.id} serverId: ${channel.serverId})`
      );

    const isPrivateChannel = hasBit(
      channel.permissions || 0,
      CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
    );
    const isAdmin = server.createdById === cacheUser.id;

    if (isPrivateChannel && !isAdmin) continue;
    socket.join(channel.id);
  }

  const isFirstConnect = await addSocketUser(cacheUser.id, socket.id, {
    status: user.status,
    custom: user.customStatus! || undefined,
    userId: cacheUser.id,
  });

  const userIds = removeDuplicates([
    ...serverMembers.map((member) => member.user.id),
    ...friendUserIds,
    cacheUser.id,
  ]);

  const presences = await getUserPresences(userIds);

  if (isFirstConnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(cacheUser.id, {
      status: user.status,
      custom: user.customStatus || undefined,
      userId: cacheUser.id,
    });
  }

  if (!socket.connected) {
    onDisconnect(socket);
    return;
  }

  socket.emit(AUTHENTICATED, {
    user: {
      ...cacheUser,
      email: user.account?.email,
      customStatus: user.customStatus,
      orderedServerIds: user.account?.serverOrderIds,
    },
    servers,
    serverMembers,
    serverRoles,
    lastSeenServerChannelIds,
    messageMentions,
    presences,
    friends: user.friends,
    channels: [...serverChannels, ...inboxChannels],
    inbox: inboxResponse,
  });
}
