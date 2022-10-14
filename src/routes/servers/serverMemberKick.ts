import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { kickServerMember } from '../../services/Server';

export function serverMemberKick(Router: Router) {
  Router.delete('/servers/:serverId/members/:userId/kick', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.KICK),
    rateLimit({
      name: 'server_kick',
      expireMS: 10000,
      requestCount: 30,
    }),
    route
  );
}


async function route (req: Request, res: Response) {

  const userId = req.params.userId as string;

  const [, error] = await kickServerMember(userId, req.serverCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({status: true});    

}