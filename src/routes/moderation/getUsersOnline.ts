import { Request, Response, Router } from 'express';
import { getAllConnectedUserIds } from '../../cache/UserCache';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getUsersOnline(Router: Router) {
  Router.get('/moderation/online-users', 
    authenticate(),
    isModMiddleware,
    route
  );
}





async function route (req: Request, res: Response) {


  const connectedUserIds = await getAllConnectedUserIds();


  const users = await prisma.user.findMany({
    where: {id: {in: connectedUserIds}},
    orderBy: {
      joinedAt: 'desc'
    },
    include: {account: {select: { email: true }}}
  });


  res.json(users);


}