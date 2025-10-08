import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteExploreItem } from '../../services/Explore';

export function exploreDelete(Router: Router) {
  Router.delete(
    '/explore/:id',
    authenticate(),
    rateLimit({
      name: 'explore_delete_server',
      restrictMS: 10000,
      requests: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [result, error] = await deleteExploreItem({
    exploreId: req.params.id!,
    requesterUserId: req.userCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ result });
}
