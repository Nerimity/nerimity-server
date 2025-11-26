import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateApplication } from '../../services/Application';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { body } from 'express-validator';

export function applicationUpdate(Router: Router) {
  Router.patch(
    '/applications/:id',
    body('name').isString().withMessage('Invalid name.').isLength({ min: 3, max: 35 }).withMessage('name must be between 3 and 35 characters long.').optional({ nullable: true }),

    body('redirectUris').isArray().withMessage('redirectUris must be an array of strings.').optional({ nullable: true }),
    body('redirectUris.*').isString().withMessage('redirectUris must be an array of strings.').isURL({ require_protocol: true }).withMessage('Each redirectUri must be a valid URL.').optional({}),

    authenticate(),
    rateLimit({
      name: 'update-app',
      restrictMS: 60000,
      requests: 5,
    }),
    route
  );
}

interface Body {
  name?: string;
  redirectUris?: string[];
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const id = req.params.id;
  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [updated, error] = await updateApplication(req.userCache.account!.id, id, body);

  if (error) {
    return res.status(403).json(error);
  }

  res.json(updated);
}
