import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { addWelcomeAnswerRolesToUser } from '../../services/ServerMember';

export function serverWelcomeAnswer(Router: Router) {
  Router.post(
    '/servers/:serverId/welcome/answers/:id/answer',
    authenticate(),
    serverMemberVerification(),

    rateLimit({
      name: 'server_welcome_answer',
      restrictMS: 5000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const answerId = req.params.id as string;

  const [success, error] = await addWelcomeAnswerRolesToUser({
    answerId,
    serverId: req.serverCache.id,
    userId: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ success });
}
