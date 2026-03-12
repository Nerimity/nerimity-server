import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getUserInventory } from '@src/services/User/User';

export function userInventoryGet(Router: Router) {
  Router.get(
    '/users/inventory',
    authenticate({ allowBot: true }),
    rateLimit({
      name: 'user_inventory',
      restrictMS: 10000,
      requests: 10,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const [inventoryItems, error] = await getUserInventory(req.userCache.id);
  if (error) {
    return res.status(400).json(error);
  }

  res.json(inventoryItems);
}
