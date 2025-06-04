import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateServerFolder } from '../../services/User/UserManagement';

export function serverFolderUpdate(Router: Router) {
  Router.post(
    '/servers/folders/:folderId',
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

  const folderId = req.params.folderId as string;

  const [folder, error] = await updateServerFolder(folderId, {
    serverIds: body.serverIds,
    userId: req.userCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(folder);
}
