import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { query } from 'express-validator';
import { rateLimit } from '@src/middleware/rateLimit';
import { customExpressValidatorResult } from '@src/common/errorHandler';
import { getOAuthApplication } from '@src/services/Oauth2';

export function oauth2AuthorizeGetRoute(Router: Router) {
  Router.get(
    '/oauth2/authorize',
    authenticate(),
    query('clientId').not().isEmpty().withMessage('clientId is required!').isString().withMessage('clientId must be a string!').isLength({ min: 1, max: 20 }).withMessage('clientId length must be between 1 and 20 characters.'),
    query('redirectUri').not().isEmpty().withMessage('redirectUri is required!').isString().withMessage('redirectUri must be a string!').isLength({ min: 1, max: 20 }).withMessage('redirectUri length must be between 1 and 20 characters.'),

    rateLimit({
      name: 'oauth2-auth-get',
      restrictMS: 60000,
      requests: 30,
    }),
    route
  );
}

interface Query {
  clientId: string;
  redirectUri: string;
}
async function route(req: Request, res: Response) {
  const query = req.query as unknown as Query;
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [result, error] = await getOAuthApplication({
    clientId: query.clientId,
    redirectUri: query.redirectUri,
    userId: req.userCache?.id,
  });
  if (error) return res.status(500).json(error);

  return res.status(200).json(result);
}
