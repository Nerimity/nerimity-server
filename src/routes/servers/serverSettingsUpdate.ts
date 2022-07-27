import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServer } from '../../services/Server';

export function serverSettingsUpdate(Router: Router) {
  Router.post('/servers/:serverId', 
    authenticate(),
    serverMemberVerification(),
    body('name')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({checkFalsy: true}),
    body('defaultChannel')
      .isString().withMessage('defaultChannel must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('defaultChannel must be between 4 and 100 characters long.').optional({checkFalsy: true}),
    route
  );
}

interface Body {
  name?: string;
  defaultChannel?: string;
}



async function route (req: Request, res: Response) {

  const isServerCreator = req.serverCache.createdBy === req.accountCache.user._id;

  if (!isServerCreator) {
    res.status(403).json(generateError('You are not allowed to perform this action'));
    return;
  }
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  const [updated, error] = await updateServer(req.serverCache._id, matchedBody);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);    

}