import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { dismissUserNotice } from '../../services/User/User';

export function userDismissNotice(Router: Router) {
  Router.delete(
    '/users/notices/:id',
    authenticate(),
    route
  );
}

async function route(req: Request, res: Response) {
  const noticeId = req.params.id as string;

  const [success, error] = await dismissUserNotice(noticeId, req.userCache.id);
  if (error) {
    return res.status(404).json(error);
  }
  res.json({success});
}
