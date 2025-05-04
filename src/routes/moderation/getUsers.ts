import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { isExpired } from '../../services/User/User';
import { queryAsArray } from '../../common/queryAsArray';

export function getUsers(Router: Router) {
  Router.get('/moderation/users', authenticate(), isModMiddleware, route);
}

const ValidOrderBy = ['joinedAt', 'username'] as const;
const ValidFilters = ['shadowBan', 'bot', 'suspension'] as const;

async function route(req: Request, res: Response) {
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  let orderBy: (typeof ValidOrderBy)[number] = 'joinedAt';

  const order = req.query.order === 'asc' ? 'asc' : 'desc';

  if (ValidOrderBy.includes(req.query.orderBy as any)) {
    orderBy = req.query.orderBy as (typeof ValidOrderBy)[number];
  }

  const filters: string[] = queryAsArray(req.query.filtersOn);

  const validFilters = filters.filter((filter) => ValidFilters.includes(filter as any)) as (typeof ValidFilters)[number][];

  let users = await prisma.user.findMany({
    orderBy: {
      [orderBy]: order,
    },
    where: {
      OR: validFilters.map((filter) => ({ [filter]: true })),
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    select: {
      shadowBan: true,
      id: true,
      username: true,
      joinedAt: true,
      tag: true,
      bot: true,
      badges: true,
      hexColor: true,
      avatar: true,
      suspension: true,
    },
  });

  users = users.map((user) => {
    if (!user.suspension?.expireAt) return user;
    if (!isExpired(user.suspension.expireAt)) return user;
    user.suspension = null;
    return user;
  });

  res.json(users);
}
