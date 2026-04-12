import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateClan } from '../../services/Server';

export function serverClanUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/clans',
    authenticate(),
    serverMemberVerification(),
    body('tag').not().isEmpty().withMessage('Tag is required').isString().withMessage('Tag must be a string.').isLength({ min: 1, max: 4 }).withMessage('Tag must be between 1 and 4 characters long.'),
    body('icon').not().isEmpty().withMessage('Icon is required').isString().withMessage('Icon must be a string.').isLength({ min: 1, max: 255 }).withMessage('Icon must be between 2 and 255 characters long.'),
    rateLimit({
      name: 'server_clan_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route,
  );
}

interface Body {
  tag: string;
  icon: string;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body: Body = req.body;

  const [clan, error] = await updateClan({
    userId: req.userCache.id,
    serverId: req.serverCache.id,
    tag: body.tag.trim(),
    icon: body.icon,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(clan);
}
