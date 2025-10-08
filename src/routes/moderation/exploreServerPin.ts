import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { dateToDateTime, prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { checkUserPassword } from '../../services/UserAuthentication';

export function exploreServerPin(Router: Router) {
  Router.post(
    '/moderation/servers/:serverId/pin',
    authenticate(),
    isModMiddleware,

    route
  );
}

interface Body {
  password: string;
}

async function route(req: Request<{ serverId: string }, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const serverId = req.params.serverId;

  const pinnedServers = await prisma.explore.count({
    where: {
      serverId: serverId,
    },
  });
  if (pinnedServers >= 4) {
    return res.status(400).json(generateError('You can only pin up to 4 servers.'));
  }

  const result = await prisma.explore
    .update({
      where: {
        serverId: serverId,
      },
      data: {
        pinnedAt: dateToDateTime(new Date()),
      },
    })
    .catch(() => {
      return false;
    });
  if (!result) {
    return res.status(400).json(generateError('Something went wrong. Try again later.'));
  }

  res.json({ success: true });
}
