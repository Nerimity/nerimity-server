import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateServerOrder } from '../../services/Server';

export function serverUpdateOrder(Router: Router) {
  Router.post('/servers/order', 
    authenticate(),
    body('serverIds')
      .isArray().withMessage('serverIds must be an array.'),
    rateLimit({
      name: 'server_update_order',
      expireMS: 10000,
      requestCount: 50,
    }),
    route
  );
}

interface Body {
  serverIds: string[]
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [updated, error] = await updateServerOrder(req.accountCache.user.id, body.serverIds);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}