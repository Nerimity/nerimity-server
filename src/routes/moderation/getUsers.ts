import { Request, Response, Router } from 'express';
import { BADGES, hasBit } from '../../common/Bitwise';
import { prisma } from '../../common/database';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';

export function getUsers(Router: Router) {
  Router.get('/moderation/users', 
    authenticate(),
    route
  );
}





async function route (req: Request, res: Response) {
  const badges = req.accountCache.user.badges;
  const after = req.query.after as string | undefined;
  const isCreator = hasBit(badges, BADGES.CREATOR.bit);
  if (!isCreator) {
    return res.status(403).json(generateError('Admin access only!'));
  }

  const users = await prisma.user.findMany({
    orderBy: {
      joinedAt: 'desc'
    },
    take: 2,
    ...(after ? {cursor: { id: after }} : undefined),
    include: {account: {select: { email: true }}}
  });


  res.json(users);


}