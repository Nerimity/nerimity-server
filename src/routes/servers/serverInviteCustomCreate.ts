import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerCustomInvite } from '../../services/ServerInvite';

export function serverInviteCustomCreate(Router: Router) {
  Router.post(
    '/servers/:serverId/invites/custom',
    authenticate(),
    serverMemberVerification(),
    body('code')
      .not()
      .isEmpty()
      .withMessage('Code is require')
      .isString()
      .withMessage('Invalid code.')
      .isLength({ min: 3, max: 32 })
      .withMessage('Code must be between 3 and 32 characters long.'),
    rateLimit({
      name: 'create_server_invite',
      restrictMS: 20000,
      requests: 5,
    }),
    route
  );
}

interface Body {
  code: string;
}

const allowedChars = 'abcdefghijklmnopqrstuvwxyz-_123456789'.split('');

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.serverCache.createdById !== req.userCache.id) {
    return res
      .status(401)
      .json(generateError('Only the server owner can create custom invites.'));
  }

  if (
    body.code
      .split('')
      .find((char) => !allowedChars.includes(char.toLowerCase()))
  ) {
    return res
      .status(401)
      .json(
        generateError('Only alphanumerical and dashes are allowed in the code.')
      );
  }

  const [invite, error] = await createServerCustomInvite(
    body.code,
    req.serverCache.id,
    req.userCache.id
  );

  if (error) {
    return res.status(403).json(error);
  }

  res.json(invite);
}
