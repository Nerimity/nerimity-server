import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deletePublicServer } from '../../services/Explore';

export function exploreServerDelete(Router: Router) {
  Router.delete(
    '/explore/servers/:serverId',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'explore_delete_server',
      restrictMS: 10000,
      requests: 15,
    }),
    param('serverId')
      .not()
      .isEmpty()
      .withMessage('serverId is required.')
      .isString()
      .withMessage('serverId must be a string.')
      .isLength({ min: 3, max: 320 })
      .withMessage('serverId must be between 3 and 320 characters long.'),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.serverCache.createdById !== req.userCache.id) {
    return res
      .status(401)
      .json(generateError('Only the server creator modify this.'));
  }

  const [publicServer, error] = await deletePublicServer(req.params.serverId);
  if (error) {
    return res.status(400).json(error);
  }

  res.json(publicServer);
}
