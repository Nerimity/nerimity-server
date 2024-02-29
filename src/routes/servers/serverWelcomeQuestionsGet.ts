import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getServerWelcomeQuestions } from '../../services/Server';

export function serverWelcomeQuestionGet(Router: Router) {
  Router.get(
    '/servers/:serverId/welcome/questions',
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
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [questions, error] = await getServerWelcomeQuestions(req.serverCache.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(questions);
}
