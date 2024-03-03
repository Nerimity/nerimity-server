import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerWelcomeQuestion } from '../../services/Server';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';

export function serverWelcomeQuestionUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/welcome/questions/:id',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),

    body('title').not().isEmpty().withMessage('Title is required').isString().withMessage('Title must be a string.').isLength({ min: 1, max: 200 }).withMessage('Title must be between 2 and 200 characters long.').optional({ nullable: true }),

    body('order').isNumeric().withMessage('Order must be a number.').optional({ nullable: true }),
    body('multiselect').isBoolean().withMessage('Multiselect must be a boolean.').optional({ nullable: true }),

    body('answers').isArray().withMessage('Answers must be an array.'),

    body('answers.*.title').not().isEmpty().withMessage('Title is required').isString().withMessage('Title must be a string.').isLength({ min: 1, max: 200 }).withMessage('Title must be between 2 and 200 characters long.'),
    body('answers.*.order').not().isEmpty().withMessage('Order is required').isNumeric().withMessage('Order must be a number.'),

    body('answers.*.roleIds').isArray().withMessage('RoleIds must be an array.'),

    body('answers.*.roleIds.*').isString().withMessage('RoleIds must be a string.'),

    rateLimit({
      name: 'server_welcome_question_update',
      expireMS: 5000,
      requestCount: 10,
    }),
    route
  );
}

interface Answer {
  title: string;
  roleIds: string[];
  order: number;
}

interface Body {
  title: string;
  multiselect: boolean;
  answers: Answer[];
  order: number;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body: Body = req.body;
  const questionId = req.params.id as string;

  if (body.answers) {
    for (let i = 0; i < body.answers.length; i++) {
      const answer = body.answers[i];
      if (!answer?.roleIds) continue;
      if (answer.roleIds.length <= 5) continue;
      return res.status(400).json(generateError('Maximum number of roles reached for ' + answer.title));
    }
  }

  const [question, error] = await updateServerWelcomeQuestion({
    id: questionId,
    order: body.order,
    serverId: req.serverCache.id,
    ...addToObjectIfExists('title', body.title),
    ...addToObjectIfExists('multiselect', body.multiselect),
    answers: body.answers,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(question);
}
