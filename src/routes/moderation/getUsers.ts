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

  const users = await prisma.user.findMany({
    orderBy: {
      joinedAt: 'desc'
    },
    ...(after ? {skip: 1} : undefined),
    take: 30,
    ...(after ? {cursor: { id: after }} : undefined),
    select: {id: true, username: true, joinedAt: true, tag: true, hexColor: true, }
  });


  res.json(users);


}