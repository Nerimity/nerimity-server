import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getUser(Router: Router) {
  Router.get('/moderation/users/:userId', 
    authenticate(),
    isModMiddleware,
    route
  );
}


async function route (req: Request, res: Response) {
  const userId = req.params.userId;

  const user = await prisma.account.findFirst({
    where: {userId},
    select: {
      email: true,
      user: {
        include: {
          profile: true,
        }
      }
    }
  });

  res.json(user);
}