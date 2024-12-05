import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteReminder } from '../../services/Reminder';

export function remindersDeleteRoute(Router: Router) {
  Router.delete(
    '/reminders/:id',
    authenticate(),

    rateLimit({
      name: 'reminders_delete',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const id = req.params.id as string;

  const [reminder, error] = await deleteReminder(id, req.userCache.id);

  if (error) {
    return res.status(400).json(error);
  }

  return res.status(200).json(reminder);
}
