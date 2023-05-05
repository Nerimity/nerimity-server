import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { joinPublicServer } from '../../services/Explore';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function exploreServerJoin(Router: Router) {
  Router.post('/explore/servers/:serverId/join', 
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
  const [server, error] = await joinPublicServer(req.accountCache.user.id, serverId);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}