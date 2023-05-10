import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getServer(Router: Router) {
  Router.get('/moderation/servers/:serverId', 
    authenticate(),
    isModMiddleware,
    route
  );
}


async function route (req: Request, res: Response) {
  const serverId = req.params.serverId;

  const server = await prisma.server.findFirst({
    where: {id: serverId},
    select: { _count: {select: {serverMembers: true}}, banner: true, name: true, verified: true, hexColor: true, id: true, createdAt: true, createdBy: {select: {id: true, username: true, tag: true}}, avatar: true}
  });

  res.json(server);
}