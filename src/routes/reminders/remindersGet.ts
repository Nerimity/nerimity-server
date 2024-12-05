import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getReminders } from '../../services/Reminder';

export function remindersGetRoute(Router: Router) {
  Router.get(
    '/reminders',
    authenticate(),

    rateLimit({
      name: 'reminders_get',
      restrictMS: 60000,
      requests: 5,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const reminders = await getReminders(req.userCache.id);

  return res.status(200).json(reminders);
}
