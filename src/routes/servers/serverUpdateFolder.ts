import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateServerFolder } from '../../services/Server';

export function serverUpdateFolder(Router: Router) {
  Router.patch(
    '/servers/folders/:folderId',
    authenticate(),
    body('serverIds').isArray().withMessage('serverIds must be an array.'),
    rateLimit({
      name: 'server_update_folder',
      restrictMS: 10000,
      requests: 50,
    }),
    route
  );
}

interface Body {
  serverIds: string[];
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const folderId = req.params.folderId as string;

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [status, error] = await updateServerFolder(req.userCache.id, folderId, body.serverIds);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status });
}
