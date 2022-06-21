import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { openDMChannel, getUserDetails } from '../../services/User';

export function userDetails(Router: Router) {
  Router.get('/users/:userId',
    authenticate(),
    param('userId')
      .not().isEmpty().withMessage('userId is required.')
      .isString().withMessage('Invalid userId.')
      .isLength({ min: 1, max: 320 }).withMessage('userId must be between 1 and 320 characters long.'),
    route
  );
}



async function route (req: Request, res: Response) {

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }
  const requesterId = req.accountCache.user._id;
  const recipientId = req.params.userId;

  const [details, error] = await getUserDetails(requesterId, recipientId);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(details);
}