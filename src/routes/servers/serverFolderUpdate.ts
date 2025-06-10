import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateServerFolder } from '../../services/User/UserManagement';

export function serverFolderUpdate(Router: Router) {
  Router.post(
    '/servers/folders/:folderId',
    authenticate(),
    body('serverIds').isArray().withMessage('serverIds must be an array.').optional({ nullable: true }),

    body('name').isString().withMessage('Name must be a string.').isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({ nullable: true }),

    body('color').isString().withMessage('color must be a string.').isLength({ min: 4, max: 100 }).withMessage('color must be between 4 and 100 characters long.').optional({ nullable: true }),

    rateLimit({
      name: 'server_update_folder',
      restrictMS: 10000,
      requests: 50,
    }),
    route
  );
}

interface Body {
  serverIds?: string[];
  name?: string;
  color?: string;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  const folderId = req.params.folderId as string;

  const [folder, error] = await updateServerFolder(folderId, {
    ...matchedBody,
    userId: req.userCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(folder);
}
