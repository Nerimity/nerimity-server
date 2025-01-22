import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { verifyPassword } from '../../services/User/User';
import { transferServerOwnership } from '../../services/Server';

export function serverTransferOwnership(Router: Router) {
  Router.post(
    '/servers/:serverId/transfer-ownership',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    body('password').isLength({ min: 0, max: 72 }).withMessage('Password must be between 0 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'),
    rateLimit({
      name: 'server_transfer_ownership',
      restrictMS: 20000,
      requests: 5,
    }),
    route
  );
}

interface body {
  password: string;
  newOwnerUserId: string;
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.serverCache.createdById !== req.userCache.id) {
    return res.status(403).json(generateError('Only the server creator can transfer ownership.'));
  }

  const body = req.body as body;

  const [isPasswordCorrect, passwordCheckError] = await verifyPassword(req.userCache.account?.id!, body.password);

  if (!isPasswordCorrect) {
    return res.status(400).json(passwordCheckError);
  }

  const [, error] = await transferServerOwnership({
    serverId: req.serverCache.id,
    newOwnerUserId: body.newOwnerUserId,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });
}
