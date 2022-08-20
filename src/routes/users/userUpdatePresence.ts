import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { UserStatus } from '../../types/User';
import { updateUserPresence } from '../../services/User';

export function userUpdatePresence(Router: Router) {
  Router.post('/users/presence',
    authenticate(),
    body('status')
      .not().isEmpty().withMessage('Status is required.')
      .isNumeric().withMessage('Invalid status.')
      .isLength({ min: 0, max: 4 }).withMessage('Presence must be between 0 and 4.'),
    route
  );
}


interface Body {
  status: UserStatus;
}

async function route (req: Request, res: Response) {

  const body: Body = req.body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [ successMessage, error ] = await updateUserPresence(req.accountCache.user.id, {status: body.status});
  if (error) {
    return res.status(400).json(error);
  }
  res.json(successMessage);
}