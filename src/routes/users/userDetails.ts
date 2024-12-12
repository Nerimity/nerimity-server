import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { getUserDetails } from '../../services/User/User';

export function userDetails(Router: Router) {
  Router.get('/users/:userId?', authenticate({ allowNoToken: true }), param('userId').isString().withMessage('Invalid userId.').isLength({ min: 1, max: 320 }).withMessage('userId must be between 1 and 320 characters long.').optional(), route);
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }
  const requesterId = req.userCache?.id;
  const recipientId = req.params.userId || requesterId;

  const includePinnedPosts = req.query.includePinnedPosts === 'true';

  const [details, error] = await getUserDetails(requesterId || '123', recipientId, req.userIP, includePinnedPosts);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(details);
}
