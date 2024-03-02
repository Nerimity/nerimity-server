import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { addServerWelcomeQuestion } from '../../services/Server';

export function serverWelcomeQuestionCreate(Router: Router) {
  Router.post(
    '/servers/:serverId/welcome/questions',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),

    body('title').not().isEmpty().withMessage('Title is required').isString().withMessage('Title must be a string.').isLength({ min: 1, max: 200 }).withMessage('Title must be between 2 and 200 characters long.'),

    body('multiselect').isBoolean().withMessage('Multiselect must be a boolean.').optional({ nullable: true }),

    body('answers').isArray().withMessage('Answers must be an array.'),

    body('answers.*.title').not().isEmpty().withMessage('Title is required').isString().withMessage('Title must be a string.').isLength({ min: 1, max: 200 }).withMessage('Title must be between 2 and 200 characters long.'),

    body('answers.*.roleIds').isArray().withMessage('RoleIds must be an array.').optional({ nullable: true }),

    body('answers.*.roleIds.*').isString().withMessage('RoleIds must be a string.'),

    rateLimit({
      name: 'server_welcome_question_create',
      expireMS: 5000,
      requestCount: 10,
    }),
    route
  );
}

interface Answer {
  title: string;
  roleIds: string[];
}

interface Body {
  title: string;
  multiselect: boolean;
  answers: Answer[];
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body: Body = req.body;

  for (let i = 0; i < body.answers.length; i++) {
    const answer = body.answers[i];
    if (!answer?.roleIds) continue;
    if (answer.roleIds.length <= 5) continue;
    return res.status(400).json(generateError('Maximum number of roles reached for ' + answer.title));
  }

  const [question, error] = await addServerWelcomeQuestion({
    title: body.title,
    answers: body.answers,
    multiselect: body.multiselect,
    serverId: req.serverCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(question);
}
