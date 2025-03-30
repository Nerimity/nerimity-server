import { Request, Response, Router } from 'express';
import { body, param } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updatePublicServer } from '../../services/Explore';

export function exploreServerUpdate(Router: Router) {
  Router.post(
    '/explore/servers/:serverId',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'explore_update_server',
      restrictMS: 10000,
      requests: 15,
    }),
    param('serverId').not().isEmpty().withMessage('serverId is required.').isString().withMessage('serverId must be a string.').isLength({ min: 3, max: 320 }).withMessage('serverId must be between 3 and 320 characters long.'),
    body('description').isString().withMessage('Description must be a string!').isLength({ min: 1, max: 150 }).withMessage('Description length must be between 1 and 150 characters.'),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.userCache.shadowBanned) {
    return res.status(403).json(generateError('Something went wrong. Try again later.'));
  }

  if (req.serverCache.createdById !== req.userCache.id) {
    return res.status(401).json(generateError('Only the server creator modify this.'));
  }

  const [publicServer, error] = await updatePublicServer(req.params.serverId, req.body.description);
  if (error) {
    return res.status(400).json(error);
  }

  res.json(publicServer);
}
