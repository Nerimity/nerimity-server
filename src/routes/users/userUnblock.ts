import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { blockUser, unblockUser } from '../../services/Friend';
import { param } from 'express-validator';

export function userUnblock(Router: Router) {
  Router.delete(
    '/users/:userId/block',
    authenticate(),
    param('userId')
      .isString()
      .withMessage('Invalid userId.')
      .isLength({ min: 1, max: 320 })
      .withMessage('userId must be between 1 and 320 characters long.')
      .optional(),
    rateLimit({
      name: 'user_block',
      expireMS: 60000,
      requestCount: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [_, error] = await unblockUser(req.userCache.id, req.params.userId);

  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });
}
