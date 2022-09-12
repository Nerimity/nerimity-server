import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerMember } from '../../services/ServerMember';
import { updateServerRole } from '../../services/ServerRole';

export function serverMemberUpdate(Router: Router) {
  Router.post('/servers/:serverId/members/:userId', 
    authenticate(),
    serverMemberVerification(),
    body('roleIds').isArray().withMessage('roleIds must be an array of strings.').optional({nullable: true}),
    body('roleIds.*')
      .isString().withMessage('roleIds must be a string.')
      .optional({}),
    route
  );
}

interface Body {
  roleIds?: string[];
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



  const [updated, error] = await updateServerMember(req.serverCache.id, req.params.userId, matchedBody);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);    

}