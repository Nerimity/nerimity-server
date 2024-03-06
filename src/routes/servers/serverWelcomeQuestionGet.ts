import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getServerWelcomeQuestion } from '../../services/Server';

export function serverWelcomeQuestionGet(Router: Router) {
  Router.get(
    '/servers/:serverId/welcome/questions/:id',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'server_welcome_question_get',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const questionId = req.params.id as string;
  const [question, error] = await getServerWelcomeQuestion(req.serverCache.id, questionId);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(question);
}
