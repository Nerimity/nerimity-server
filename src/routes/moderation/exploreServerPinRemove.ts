import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { checkUserPassword } from '../../services/UserAuthentication';

export function exploreServerPinRemove(Router: Router) {
  Router.delete(
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

  const result = await prisma.publicServer
    .update({
      where: {
        serverId: serverId,
      },
      data: {
        pinnedAt: null,
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
