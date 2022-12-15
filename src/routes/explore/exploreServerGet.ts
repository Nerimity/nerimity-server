import { Request, Response, Router } from 'express';
import {param} from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { getPublicServer } from '../../services/Explore';

export function exploreServerGet(Router: Router) {
  Router.get('/explore/servers/:serverId', 
    authenticate(),
    param('serverId')
      .not().isEmpty().withMessage('serverId is required.')
      .isString().withMessage('serverId must be a string.')
      .isLength({ min: 3, max: 320}).withMessage('serverId must be between 3 and 320 characters long.'),
    route
  );
}


async function route (req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [publicServer, error] = await getPublicServer(req.params.serverId);
  if (error) {
    return res.status(400).json(error);
  }

  res.json(publicServer);
}