import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { upsertExploreItem } from '../../services/Explore';

export function exploreBotAppUpdate(Router: Router) {
  Router.post(
    '/explore/bots/:appId',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'explore_update_server',
      restrictMS: 10000,
      requests: 15,
    }),
    body('description').isString().withMessage('Description must be a string!').isLength({ min: 1, max: 150 }).withMessage('Description length must be between 1 and 150 characters.'),
    body('permissions').isNumeric().withMessage('Permissions must be a number.').isInt({ min: 0, max: 900 }).withMessage('Permissions must be between 0 and 900.').isLength({ min: 0, max: 100 }).withMessage('Permissions must be between 0 and 100 characters long.').optional({ nullable: true }),
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

  const [publicBot, error] = await upsertExploreItem({
    botApplicationId: req.params.appId,
    description: req.body.description,
    updatedByAccountId: req.userCache.account?.id,
    botPermissions: req.body.permissions,
  });
  if (error) {
    return res.status(400).json(error);
  }

  res.json(publicBot);
}
