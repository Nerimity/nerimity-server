import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createServerFolder } from '../../services/Server';

export function serverCreateFolder(Router: Router) {
  Router.post(
    '/servers/folders',
    authenticate(),
    body('serverIds').isArray().withMessage('serverIds must be an array.'),
    rateLimit({
      name: 'server_create_folder',
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

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [folderId, error] = await createServerFolder(req.userCache.id, body.serverIds);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ folderId });
}
