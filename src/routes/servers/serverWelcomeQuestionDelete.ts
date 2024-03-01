import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteQuestion } from '../../services/Server';

export function serverWelcomeQuestionDelete(Router: Router) {
  Router.delete(
    '/servers/:serverId/welcome/questions/:id',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),

    rateLimit({
      name: 'server_welcome_question_delete',
      expireMS: 5000,
      requestCount: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const questionId = req.params.id as string;

  const [status, error] = await deleteQuestion(req.serverCache.id, questionId);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status });
}
