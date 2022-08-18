import { Request, Response, Router } from 'express';
import {param} from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { acceptFriend } from '../../services/Friend';

export function friendAccept(Router: Router) {
  Router.post('/friends/:friendId', 
    authenticate(),
    param('friendId')
      .not().isEmpty().withMessage('friendId is required.')
      .isString().withMessage('friendId must be a string.')
      .isLength({ min: 3, max: 320}).withMessage('friendId must be between 3 and 320 characters long.'),
    route
  );
}




async function route (req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [statusMessage, error] = await acceptFriend(req.accountCache.user.id, req.params.friendId);
  if (error) {
    return res.status(400).json(error);
  }

  res.json(statusMessage);

}