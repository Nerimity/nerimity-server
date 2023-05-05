import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { bumpPublicServer } from '../../services/Explore';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function exploreServerBump(Router: Router) {
  Router.post('/explore/servers/:serverId/bump', 
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

  const { serverId } = req.params;
  const [server, error] = await bumpPublicServer(serverId);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}