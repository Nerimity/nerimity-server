import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { searchMessagesByServerId } from '../../services/Message/Message';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { addBit, CHANNEL_PERMISSIONS, hasBit, ROLE_PERMISSIONS } from '../../common/Bitwise';
import { prisma } from '../../common/database';
import { query } from 'express-validator';
import { ensureArray } from '@src/common/utils';
import { ChannelType } from '../../types/Channel';
import { serverMemberHasPermission } from '../../common/serverMembeHasPermission';

export function serverSearchMessages(Router: Router) {
  Router.get(
    '/servers/:serverId/messages/search',
    authenticate(),
    serverMemberVerification(),
    query('query').isString().withMessage('Invalid query.').isLength({ min: 1, max: 50 }).withMessage('query must be between 1 and 50 characters long.').optional({ nullable: true }),
    query('order').isString().withMessage('Invalid order.').isLength({ min: 1, max: 50 }).withMessage('order must be between 1 and 50 characters long.').optional({ nullable: true }),

    query('user_id')
      .optional({ nullable: true })
      .toArray()
      .isArray()
      .withMessage('user_id must be an array.')
      .custom((ids: any[]) => ids.every((id) => typeof id === 'string' && id.length >= 1 && id.length <= 100))
      .withMessage('Each user_id must be a string between 1 and 100 characters.'),

    rateLimit({
      name: 'messages_search',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const limit = parseInt((req.query.limit as string) || '50') || undefined;
  const after = (req.query.after as string) || undefined;
  const before = (req.query.before as string) || undefined;
  const query = req.query.query as string;
  const order = (req.query.order || 'desc') as 'asc' | 'desc';
  const userIds = ensureArray(req.query.user_id);

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!['desc', 'asc'].includes(order)) {
    return res.status(400).json(generateError('Invalid order.'));
  }

  const isCreator = req.serverCache.createdById === req.userCache.id;

  const [channels, member, roles] = await Promise.all([
    prisma.channel.findMany({
      where: {
        serverId: req.serverCache.id,
        type: ChannelType.SERVER_TEXT,
      },
      select: {
        id: true,
        permissions: {
          select: {
            roleId: true,
            permissions: true,
          },
        },
      },
    }),
    isCreator
      ? Promise.resolve(null)
      : prisma.serverMember.findUnique({
        where: {
          userId_serverId: {
            serverId: req.serverCache.id,
            userId: req.userCache.id,
          },
        },
        select: { roleIds: true },
      }),
    isCreator
      ? Promise.resolve([])
      : prisma.serverRole.findMany({
        where: { serverId: req.serverCache.id },
        select: { id: true, permissions: true },
      }),
  ]);

  if (!isCreator && !member) {
    return res.status(403).json(generateError('Server member is not in this server.'));
  }

  const hasAdminPermission = member
    ? serverMemberHasPermission({
      permission: ROLE_PERMISSIONS.ADMIN,
      member,
      serverRoles: roles,
      defaultRoleId: req.serverCache.defaultRoleId,
    })
    : false;
  const canAccessAllChannels = isCreator || hasAdminPermission;

  const roleIds = new Set([...(member?.roleIds ?? []), req.serverCache.defaultRoleId]);
  const accessibleChannelIds = channels
    .filter((channel) => {
      if (canAccessAllChannels) return true;

      const permissions = channel.permissions.reduce((total, permission) => {
        if (!roleIds.has(permission.roleId)) return total;
        return addBit(total, permission.permissions || 0);
      }, 0);

      return hasBit(permissions, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);
    })
    .map((channel) => channel.id);

  const t1 = performance.now();
  const messages = await searchMessagesByServerId(req.serverCache.id, accessibleChannelIds, {
    query,
    order,
    limit,
    afterMessageId: after,
    beforeMessageId: before,
    requesterId: req.userCache.id,
    userIds,
  });

  res.setHeader('T-msg-took', (performance.now() - t1).toFixed(2) + 'ms');
  res.json(messages);
}
