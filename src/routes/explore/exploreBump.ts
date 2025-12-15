import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { bumpExploreItem } from '../../services/Explore';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { turnstileVerify } from '../../common/turnstileVerify';

export function exploreBump(Router: Router) {
  Router.post('/explore/:id/bump', authenticate(), body('token').isString().withMessage('Token must be a string.').isLength({ min: 1, max: 5000 }).withMessage('Token must be between 1 and 5000 characters long.'), route);
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const validToken = await turnstileVerify(req.body.token);

  if (!validToken) {
    return res.status(403).json(generateError('Invalid captcha! Please try again.', 'token'));
  }

  const { id } = req.params;
  const [server, error] = await bumpExploreItem({
    exploreId: id!,
    bumpedByUserId: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}
