import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getUsers(Router: Router) {
  Router.get('/moderation/users', 
    authenticate(),
    isModMiddleware,
    route
  );
}





async function route (req: Request, res: Response) {
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }


  const users = await prisma.user.findMany({
    orderBy: {
      joinedAt: 'desc'
    },
    ...(after ? {skip: 1} : undefined),
    take: limit,
    ...(after ? {cursor: { id: after }} : undefined),
    select: {id: true, username: true, joinedAt: true, tag: true, hexColor: true, avatar: true }
  });


  res.json(users);


}