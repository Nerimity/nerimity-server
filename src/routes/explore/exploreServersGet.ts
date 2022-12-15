import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import {  getPublicServers } from '../../services/Explore';


// sort: 'most_bumps' | 'most_members' | 'recently_added'
// filter: 'all' | 'verified'

export function exploreServersGet(Router: Router) {
  Router.get('/explore/servers', 
    authenticate(),
    route
  );
}


async function route (req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const {sort, filter} = req.query as unknown as Record<string, string>;

  const publicServer = await getPublicServers(sort as any, filter as any);

  res.json(publicServer);
}