import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteOrLeaveServer } from '../../services/Server';

export function serverDeleteOrLeave(Router: Router) {
  Router.delete('/servers/:serverId', 
    authenticate(),
    serverMemberVerification(),
    route
  );
}



async function route (req: Request, res: Response) {

  const [server, error]  = await deleteOrLeaveServer(req.accountCache.user.id, req.serverCache.id);
  if (error) {
    return res.status(500).json(error);
  }
  res.json(server);

}