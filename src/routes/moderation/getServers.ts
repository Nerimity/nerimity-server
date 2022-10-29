import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getServers(Router: Router) {
  Router.get('/moderation/servers', 
    authenticate(),
    isModMiddleware,
    route
  );
}





async function route (req: Request, res: Response) {
  const after = req.query.after as string | undefined;


  const users = await prisma.server.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 30,
    ...(after ? {cursor: { id: after }} : undefined),
    select: {name: true, hexColor: true, id: true, createdAt: true, createdBy: {select: {id: true, username: true, tag: true, hexColor: true}}}
  });


  res.json(users);


}