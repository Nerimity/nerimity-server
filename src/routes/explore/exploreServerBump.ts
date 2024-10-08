import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { bumpPublicServer } from '../../services/Explore';
import { body, param } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { turnstileVerify } from '../../common/turnstileVerify';

export function exploreServerBump(Router: Router) {
  Router.post('/explore/servers/:serverId/bump',
    authenticate(),
    body('token')
      .isString().withMessage('Token must be a string.')
      .isLength({ min: 1, max: 5000 }).withMessage('Token must be between 1 and 5000 characters long.'),
    param('serverId')
      .not().isEmpty().withMessage('serverId is required.')
      .isString().withMessage('serverId must be a string.')
      .isLength({ min: 3, max: 320 }).withMessage('serverId must be between 3 and 320 characters long.'),
    route
  );
}

async function route(req: Request, res: Response) {

  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const validToken = await turnstileVerify(req.body.token);

  if (!validToken) {
    return res.status(401).json(generateError('Invalid captcha! Please try again.', 'token'));
  }

  const { serverId } = req.params;
  const [server, error] = await bumpPublicServer(serverId!, req.userCache.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}