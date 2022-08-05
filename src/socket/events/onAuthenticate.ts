import { Socket } from 'socket.io';
import { addSocketUser, authenticateUser, getUserPresences } from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
import { CHANNEL_PERMISSIONS, hasPermission } from '../../common/Permissions';
import { removeDuplicates } from '../../common/utils';
import { emitError } from '../../emits/Connection';
import { emitUserPresenceUpdate } from '../../emits/User';
import { Channel } from '../../models/ChannelModel';
import { Inbox } from '../../models/InboxModel';
import { User, UserModel, UserStatus } from '../../models/UserModel';
import { getAllMessageMentions, getLastSeenServerChannelIdsByUserId } from '../../services/Channel';
import { getInbox } from '../../services/Inbox';
import { getServers } from '../../services/Server';
import { onDisconnect } from './onDisconnect';

interface Payload {
  token: string;
}

export async function onAuthenticate(socket: Socket, payload: Payload) {
  const [accountCache, error] = await authenticateUser(payload.token);
  if (error !== null) {
    emitError(socket, { message: error, disconnect: true });
    return;
  }
  const cacheUser = accountCache.user;
  socket.join(accountCache.user._id);

  const user = (await UserModel.findOne({ _id: accountCache.user._id })
    .populate({ path: 'friends', populate: { path: 'recipient', model: 'User' }, select: '-_id'}).select('status friends'))?.toObject({ versionKey: false });
    
  if (!user) {
    emitError(socket, { message: 'User not found.', disconnect: true });
    return;
  }
  const {servers, serverChannels, serverMembers} = await getServers(cacheUser._id);

  const lastSeenServerChannelIds = await getLastSeenServerChannelIdsByUserId(cacheUser._id);

  const messageMentions = await getAllMessageMentions(cacheUser._id);


  const inbox = await getInbox(cacheUser._id);
  const inboxChannels: Channel[] = [];

  const inboxResponse: Inbox[] = inbox.map((item: any) => {
    inboxChannels.push(item.channel);
    item.channel = item.channel._id;
    return item;
  });
  
  const friendUserIds = user.friends.map((friend: any) => friend.recipient._id);


  // join room
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    socket.join(server._id.toString());
  }

  for (let i = 0; i < serverChannels.length; i++) {
    const channel = serverChannels[i];

    const server = servers.find(server => server._id.toString() === channel.server?.toString());
    if (!server) throw new Error(`Server not found (channelId: ${channel.id} serverId: ${channel.server?.toString()})`);
    
    const isPrivateChannel = hasPermission(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    const isAdmin = server.createdBy?.equals(cacheUser._id);

    if (isPrivateChannel && !isAdmin) continue;
    socket.join(channel._id.toString());
    
  }

  
  const isFirstConnect = await addSocketUser(cacheUser._id, socket.id, {
    status: user.status,
    userId: cacheUser._id
  });

  const userIds = removeDuplicates([
    ...serverMembers.map(member => member.user._id.toString()),
    ...friendUserIds,
    cacheUser._id.toString()
  ]);

  const presences = await getUserPresences(userIds);

  if (isFirstConnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(cacheUser._id, {status: user.status, userId: cacheUser._id}, socket.id);
  }


  if (!socket.connected) {
    onDisconnect(socket);
    return;
  }


  socket.emit(AUTHENTICATED, {
    user: cacheUser,
    servers,
    lastSeenServerChannelIds,
    messageMentions,
    serverMembers,
    presences,
    friends: user.friends,
    channels: [...serverChannels, ...inboxChannels],
    inbox: inboxResponse,
  });
}