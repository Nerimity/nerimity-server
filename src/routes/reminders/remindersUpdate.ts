import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateReminder } from '../../services/Reminder';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { body } from 'express-validator';

export function remindersUpdateRoute(Router: Router) {
  Router.post(
    '/reminders/:id',
    authenticate(),
    body('timestamp').not().isEmpty().withMessage('timestamp is required.').isNumeric().isLength({ min: 1, max: 255 }).withMessage('Invalid timestamp.'),

    rateLimit({
      name: 'reminders_update',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const id = req.params.id as string;

  const [reminder, error] = await updateReminder(id, req.userCache.id, req.body.timestamp);

  if (error) {
    return res.status(400).json(error);
  }

  return res.status(200).json(reminder);
}
