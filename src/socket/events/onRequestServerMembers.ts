import { Socket } from 'socket.io';
import { getUserIdBySocketId } from '../../cache/UserCache';
import { prisma, publicUserExcludeFields } from '@src/common/database';
import { hasFetchedMembers, markMembersFetched } from '../socket';
import { filterLastOnlineDetailsFromServerMembers } from '@src/services/Server';
import { SERVER_MEMBERS_FETCHED } from '@src/common/ClientEventNames';

interface Payload {
  serverId: string;
}

export async function onRequestServerMembers(socket: Socket, payload: Payload) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  const alreadyFetched = hasFetchedMembers(socket.id, payload.serverId);
  if (alreadyFetched) return;

  const isInServer = await prisma.serverMember.findUnique({ where: { userId_serverId: { userId, serverId: payload.serverId } }, select: { id: true } });
  if (!isInServer) return;

  markMembersFetched(socket.id, payload.serverId);

  const members = await prisma.serverMember.findMany({
    where: { serverId: payload.serverId },
    include: { user: { select: { ...publicUserExcludeFields, profile: { select: { font: true, clan: { select: { tag: true, icon: true, serverId: true } } } }, lastOnlineAt: true, lastOnlineStatus: true } } },
  });

  const updatedServerMembers = filterLastOnlineDetailsFromServerMembers(members, userId);

  socket.emit(SERVER_MEMBERS_FETCHED, { serverId: payload.serverId, members: updatedServerMembers });
}
