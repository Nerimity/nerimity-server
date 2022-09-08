import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerRole } from '../../services/ServerRole';

export function serverRoleUpdate(Router: Router) {
  Router.post('/servers/:serverId/roles/:roleId', 
    authenticate(),
    serverMemberVerification(),
    body('name')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({nullable: true}),
    body('hexColor')
      .isString().withMessage('hexColor must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({nullable: true}),
    body('permissions')
      .isNumeric().withMessage('Permissions must be a number.')
      .isLength({ min: 0, max: 100 }).withMessage('Permissions must be between 0 and 100 characters long.').optional({nullable: true }),
    route
  );
}

interface Body {
  name?: string;
  permissions?: number;
}



async function route (req: Request, res: Response) {

  const isServerCreator = req.serverCache.createdById === req.accountCache.user.id;

  if (!isServerCreator) {
    res.status(403).json(generateError('You are not allowed to perform this action'));
    return;
  }

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);



  const [updated, error] = await updateServerRole(req.serverCache.id, req.params.roleId, matchedBody);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);    

}