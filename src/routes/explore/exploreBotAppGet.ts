import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { getExploreItem } from '../../services/Explore';

export function exploreBotAppGet(Router: Router) {
  Router.get('/explore/bots/:botId', authenticate(), route);
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [publicServer, error] = await getExploreItem({
    botApplicationId: req.params.botId,
  });
  if (error) {
    return res.status(400).json(error);
  }

  res.json(publicServer);
}
